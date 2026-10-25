// FE-128 — API nạp Coin (user side).
//
// POST — tạo yêu cầu nạp (pending). GET — danh sách yêu cầu của user hiện tại.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { validateTopupInput, vndToCoin, countPendingByUser, MAX_PENDING_PER_USER, bankMemo, getTopupBankInfo } from "@/lib/coinTopup";
import { isTrialMode, TRIAL_TOPUP_MESSAGE, PREVIEW_MONEY_MESSAGE } from "@/lib/trialMode";
import { isPreviewEnv } from "@/lib/planLimits";
import { logAction } from "@/lib/auditLog";

type TopupDelegate = {
  create(args: { data: unknown }): Promise<{ id: string; amountVnd: number; coinAmount: number; status: string; createdAt: Date }>;
  findMany(args: unknown): Promise<unknown[]>;
};
function topups(): TopupDelegate {
  return (prisma as unknown as { coinTopupRequest: TopupDelegate }).coinTopupRequest;
}

// Thiếu cấu hình nhận tiền (biến môi trường) → null: giao diện ẩn khối chuyển khoản thay vì hiện số tài khoản giả.
function bankOf(userId: string) {
  const b = getTopupBankInfo();
  return b ? { ...b, memo: bankMemo(userId) } : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  // Coin của học sinh chỉ kiếm bằng học (thưởng làm bài), không mua bằng tiền. Học phí chuyển khoản
  // đi đường riêng (phiếu học phí + webhook SePay), không qua Coin.
  if (auth.role === "student") {
    return NextResponse.json({ error: "Coin của học sinh nhận từ làm bài, không nạp bằng tiền. Học phí chuyển khoản theo phiếu của gia sư." }, { status: 403 });
  }

  // KiN Pro giai đoạn 0: gia sư chưa cần nạp Coin khi đang chạy thử (cùng cờ chạy thử đã chặn mua gói, xem trialMode.ts). Chặn TRƯỚC khi tạo bất kỳ bản ghi nào.
  if (auth.role === "admin" && auth.adminRole === "teacher" && isTrialMode()) {
    return NextResponse.json({ error: TRIAL_TOPUP_MESSAGE, trial: true }, { status: 403 });
  }
  // Bản xem trước dùng chung DB production: không tạo yêu cầu tiền ở đó.
  if (isPreviewEnv()) return NextResponse.json({ error: PREVIEW_MONEY_MESSAGE }, { status: 403 });

  let body: unknown = null;
  try { body = await req.json(); } catch { /* fall through */ }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const parsed = validateTopupInput(body as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const pending = await countPendingByUser(auth.userId);
  if (pending >= MAX_PENDING_PER_USER) {
    return NextResponse.json(
      { error: `Bạn đang có ${pending} yêu cầu chờ duyệt — hãy đợi admin xử lý trước khi tạo thêm.` },
      { status: 429 },
    );
  }

  const created = await topups().create({
    data: {
      userId:     auth.userId,
      amountVnd:  parsed.amountVnd,
      coinAmount: vndToCoin(parsed.amountVnd),
      bankRef:    parsed.bankRef,
      note:       parsed.note,
      // status mặc định "pending"
    },
  });

  await logAction(auth.userId, "coin_topup.request", "CoinTopupRequest", created.id, {
    amountVnd: parsed.amountVnd, bankRef: parsed.bankRef,
  });

  return NextResponse.json({
    request: created,
    bank:    bankOf(auth.userId),
  }, { status: 201 });
}

export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const items = await topups().findMany({
    where:   { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take:    30,
  });

  return NextResponse.json({ items, bank: bankOf(auth.userId) });
}
