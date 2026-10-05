// FE-128 — API admin list topup requests. admin_super/admin_content thấy
// tất cả; gia sư KHÔNG có quyền duyệt (xung đột quyền lợi — gia sư cũng là
// user nạp Coin).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

type TopupDelegate = { findMany(args: unknown): Promise<unknown[]> };

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_REVENUE);
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.status = status;
  }

  const items = await (prisma as unknown as { coinTopupRequest: TopupDelegate }).coinTopupRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], // pending đầu
    take:    100,
    include: { user: { select: { id: true, name: true, email: true, adminRole: true } } },
  });
  return NextResponse.json({ items });
}
