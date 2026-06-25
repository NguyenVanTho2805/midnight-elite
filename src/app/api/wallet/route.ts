import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/wallet — số dư xu + 20 giao dịch gần nhất của user hiện tại
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ balance: 0, transactions: [] });

  const [wallet, transactions] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: session.userId } }),
    prisma.coinTransaction.findMany({
      where:   { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take:    20,
    }),
  ]);

  return NextResponse.json({ balance: wallet?.balance ?? 0, transactions });
}
