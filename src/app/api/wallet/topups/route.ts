// FE-128 — API nạp Coin (user side).
//
// POST — tạo yêu cầu nạp (pending). GET — danh sách yêu cầu của user hiện tại.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { validateTopupInput, vndToCoin, countPendingByUser, MAX_PENDING_PER_USER, bankMemo, getTopupBank } from "@/lib/coinTopup";
import { isTrialMode, TRIAL_MODE_TOPUP_MESSAGE } from "@/lib/trialMode";
import { logAction } from "@/lib/auditLog";

type TopupDelegate = {
  create(args: { data: unknown }): Promise<{ id: string; amountVnd: number; coinAmount: number; status: string; createdAt: Date }>;
  findMany(args: unknown): Promise<unknown[]>;
};
function topups(): TopupDelegate {
  return (prisma as unknown as { coinTopupRequest: TopupDelegate }).coinTopupRequest;
}

// Tài khoản nhận + nội dung chuyển khoản. null khi chủ dự án chưa đặt tài khoản thật (xem src/lib/topupBank.ts): không bịa số.
function bankFor(userId: string) {
  const b = getTopupBank();
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

  // PRO D2 — đang chạy thử miễn phí thì không nhận yêu cầu nạp: giao diện đã ẩn form nhưng API vẫn gọi trực tiếp được,
  // và tiền thật chuyển vào lúc này sẽ thành số dư Coin không có đường hoàn. Chặn TRƯỚC khi đọc thân yêu cầu hay ghi DB.
  if (isTrialMode()) {
    return NextResponse.json({ error: TRIAL_MODE_TOPUP_MESSAGE, trial: true }, { status: 403 });
  }

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
    bank:    bankFor(auth.userId),
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

  return NextResponse.json({ items, bank: bankFor(auth.userId) });
}
