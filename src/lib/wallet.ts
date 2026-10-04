import { prisma } from "@/lib/prisma";
import {
  SIGNUP_BONUS,
  COIN_REASONS,
  DEFAULT_SOURCE_TYPE_FOR_REASON,
  type CoinSourceType,
} from "@/lib/wallet-constants";

export { SIGNUP_BONUS, QUESTION_COST, ANSWER_REWARD } from "@/lib/wallet-constants";

export class InsufficientBalanceError extends Error {
  constructor() { super("Số dư xu không đủ"); }
}

// Options mở rộng cho spendCoins/addCoins — tất cả tuỳ chọn. Để nguyên cũ
// kiểu nào bỏ opts kiểu đó, bản ghi sẽ dùng sourceType mặc định suy ra từ
// reason (nếu có trong bảng) và classId = null.
export interface CoinOpts {
  sourceType?: CoinSourceType;
  classId?: string | null;
}

function resolveSourceType(reason: string, opts?: CoinOpts): CoinSourceType | null {
  if (opts?.sourceType) return opts.sourceType;
  return DEFAULT_SOURCE_TYPE_FOR_REASON[reason as keyof typeof DEFAULT_SOURCE_TYPE_FOR_REASON] ?? null;
}

// Tạo ví + tặng xu khởi đầu cho user mới — gọi ngay sau khi tạo User.
export async function grantSignupBonus(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.wallet.create({ data: { userId, balance: SIGNUP_BONUS } }),
    prisma.coinTransaction.create({
      data: {
        userId,
        amount:     SIGNUP_BONUS,
        reason:     COIN_REASONS.SIGNUP_BONUS,
        sourceType: resolveSourceType(COIN_REASONS.SIGNUP_BONUS),
      },
    }),
  ]);
}

// Trừ xu — atomic, throw InsufficientBalanceError nếu không đủ số dư.
export async function spendCoins(
  userId: string, amount: number, reason: string, refId?: string, opts?: CoinOpts,
): Promise<void> {
  const sourceType = resolveSourceType(reason, opts);
  const classId    = opts?.classId ?? null;
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) throw new InsufficientBalanceError();

    await tx.wallet.update({ where: { userId }, data: { balance: { decrement: amount } } });
    await tx.coinTransaction.create({
      data: { userId, amount: -amount, reason, refId, sourceType, classId },
    });
  });
}

// Cộng xu — atomic, dùng cho thưởng/hoàn xu.
export async function addCoins(
  userId: string, amount: number, reason: string, refId?: string, opts?: CoinOpts,
): Promise<void> {
  const sourceType = resolveSourceType(reason, opts);
  const classId    = opts?.classId ?? null;
  await prisma.$transaction([
    prisma.wallet.upsert({
      where:  { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    }),
    prisma.coinTransaction.create({
      data: { userId, amount, reason, refId, sourceType, classId },
    }),
  ]);
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}

// Cộng xu có cap theo ngày — dùng cho thưởng bài/trả lời cộng đồng. Trả
// true nếu thưởng được ghi, false nếu đã vượt cap. Serializable qua Postgres
// advisory_xact_lock keyed on (userId, reason) để 2 request đồng thời không
// cùng qua guard "count < cap" rồi cùng cộng xu (TOCTOU) — lock tự nhả khi
// transaction kết thúc. KHÔNG đổi schema. "Hôm nay" tính theo giờ local
// server (cùng cách 2 call-site cũ setHours(0,0,0,0)), giữ hành vi cũ nên
// không rework timezone.
export async function addDailyCappedCoins(
  userId: string, amount: number, reason: string, refId: string, cap: number, opts?: CoinOpts,
): Promise<boolean> {
  const sourceType = resolveSourceType(reason, opts);
  const classId    = opts?.classId ?? null;
  const lockKey    = `${userId}:${reason}`;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const todayCount = await tx.coinTransaction.count({
      where: { userId, reason, createdAt: { gte: todayStart } },
    });
    if (todayCount >= cap) return false;
    await tx.wallet.upsert({
      where:  { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.coinTransaction.create({
      data: { userId, amount, reason, refId, sourceType, classId },
    });
    return true;
  });
}
