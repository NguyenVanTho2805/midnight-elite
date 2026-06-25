import { prisma } from "@/lib/prisma";
import { SIGNUP_BONUS } from "@/lib/wallet-constants";

export { SIGNUP_BONUS, QUESTION_COST, ANSWER_REWARD } from "@/lib/wallet-constants";

export class InsufficientBalanceError extends Error {
  constructor() { super("Số dư xu không đủ"); }
}

// Tạo ví + tặng xu khởi đầu cho user mới — gọi ngay sau khi tạo User.
export async function grantSignupBonus(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.wallet.create({ data: { userId, balance: SIGNUP_BONUS } }),
    prisma.coinTransaction.create({
      data: { userId, amount: SIGNUP_BONUS, reason: "signup_bonus" },
    }),
  ]);
}

// Trừ xu — atomic, throw InsufficientBalanceError nếu không đủ số dư.
export async function spendCoins(userId: string, amount: number, reason: string, refId?: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) throw new InsufficientBalanceError();

    await tx.wallet.update({ where: { userId }, data: { balance: { decrement: amount } } });
    await tx.coinTransaction.create({ data: { userId, amount: -amount, reason, refId } });
  });
}

// Cộng xu — atomic, dùng cho thưởng/hoàn xu.
export async function addCoins(userId: string, amount: number, reason: string, refId?: string): Promise<void> {
  await prisma.$transaction([
    prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: amount },
      update: { balance: { increment: amount } },
    }),
    prisma.coinTransaction.create({ data: { userId, amount, reason, refId } }),
  ]);
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}
