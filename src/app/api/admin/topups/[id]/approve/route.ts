// FE-128 — admin approve topup: cộng Coin + ghi CoinTransaction + đóng
// request. Trong $transaction + pg_advisory_xact_lock theo userId để
// không race với purchase VIP đang trừ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { COIN_REASONS, COIN_SOURCE_TYPES } from "@/lib/wallet-constants";
import { logAction } from "@/lib/auditLog";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as unknown as {
        coinTopupRequest: {
          findUnique(args: unknown): Promise<{ id: string; userId: string; coinAmount: number; status: string } | null>;
          update(args: unknown): Promise<unknown>;
        };
      };
      const req = await txAny.coinTopupRequest.findUnique({ where: { id } });
      if (!req) throw Object.assign(new Error("NOT_FOUND"), { status: 404, body: "Không tìm thấy yêu cầu nạp" });
      if (req.status !== "pending") {
        throw Object.assign(new Error("ALREADY_REVIEWED"), {
          status: 409, body: `Yêu cầu đã ${req.status === "approved" ? "được duyệt" : "bị từ chối"} trước đó`,
        });
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${req.userId}`}))`;

      // Upsert wallet nếu lần đầu — tránh fail khi user chưa có wallet row.
      const wallet = await tx.wallet.upsert({
        where:  { userId: req.userId },
        create: { userId: req.userId, balance: req.coinAmount },
        update: { balance: { increment: req.coinAmount } },
      });

      await tx.coinTransaction.create({
        data: {
          userId:     req.userId,
          amount:     req.coinAmount,
          reason:     COIN_REASONS.TOPUP,
          refId:      req.id,
          sourceType: COIN_SOURCE_TYPES.TOPUP,
          classId:    null,
        },
      });

      await txAny.coinTopupRequest.update({
        where: { id },
        data:  { status: "approved", reviewedBy: auth.userId, reviewedAt: new Date() },
      });

      return { topupId: req.id, userId: req.userId, coinAmount: req.coinAmount, newBalance: wallet.balance };
    });

    await logAction(auth.userId, "coin_topup.approve", "CoinTopupRequest", result.topupId, {
      userId: result.userId, coinAmount: result.coinAmount, newBalance: result.newBalance,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const err = e as { status?: number; body?: string };
    if (err.status && err.body) return NextResponse.json({ error: err.body }, { status: err.status });
    console.error("[POST /api/admin/topups/[id]/approve]", e);
    return NextResponse.json({ error: "Duyệt thất bại" }, { status: 500 });
  }
}
