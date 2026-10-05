// FE-128 — admin từ chối topup. Không cộng Coin, chỉ đóng request.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";

type TopupDelegate = {
  findUnique(args: unknown): Promise<{ id: string; status: string; userId: string } | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  let body: unknown = null;
  try { body = await req.json(); } catch { /* không bắt buộc có body */ }
  const reason = body && typeof body === "object" && typeof (body as Record<string, unknown>).reason === "string"
    ? ((body as Record<string, unknown>).reason as string).trim().slice(0, 500) : null;

  const delegate = (prisma as unknown as { coinTopupRequest: TopupDelegate }).coinTopupRequest;
  // updateMany với guard status=pending → race giữa 2 admin cùng bấm reject
  // thì chỉ 1 người đổi được state.
  const flipped = await delegate.updateMany({
    where: { id, status: "pending" },
    data:  { status: "rejected", rejectReason: reason, reviewedBy: auth.userId, reviewedAt: new Date() },
  });
  if (flipped.count === 0) {
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
    return NextResponse.json({ error: `Yêu cầu đã được ${existing.status === "approved" ? "duyệt" : "từ chối"} trước đó` }, { status: 409 });
  }

  const updated = await delegate.findUnique({ where: { id } });
  await logAction(auth.userId, "coin_topup.reject", "CoinTopupRequest", id, {
    userId: updated?.userId, reason,
  });

  return NextResponse.json({ ok: true });
}
