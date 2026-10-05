// FE-128 — API nạp Coin (user side).
//
// POST — tạo yêu cầu nạp (pending). GET — danh sách yêu cầu của user hiện tại.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { validateTopupInput, vndToCoin, countPendingByUser, MAX_PENDING_PER_USER, bankMemo, BANK_INFO } from "@/lib/coinTopup";
import { logAction } from "@/lib/auditLog";

type TopupDelegate = {
  create(args: { data: unknown }): Promise<{ id: string; amountVnd: number; coinAmount: number; status: string; createdAt: Date }>;
  findMany(args: unknown): Promise<unknown[]>;
};
function topups(): TopupDelegate {
  return (prisma as unknown as { coinTopupRequest: TopupDelegate }).coinTopupRequest;
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

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
    bank:    { ...BANK_INFO, memo: bankMemo(auth.userId) },
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

  return NextResponse.json({ items, bank: { ...BANK_INFO, memo: bankMemo(auth.userId) } });
}
