import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BADGE_RULES } from "@/lib/honorData";

// GET — danh sách badges đã trao theo userId hoặc tất cả
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_HONOR);
  if (isNextResponse(auth)) return auth;

  const userId = req.nextUrl.searchParams.get("userId");

  const badges = await prisma.userBadge.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json(badges);
}

// POST — trao badge cho user
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_HONOR);
  if (isNextResponse(auth)) return auth;

  const { userId, badgeId } = await req.json();
  if (!userId || !badgeId) {
    return NextResponse.json({ error: "Thiếu userId hoặc badgeId" }, { status: 400 });
  }

  if (!BADGE_RULES.some(rule => rule.id === badgeId)) {
    return NextResponse.json({ error: "Không tìm thấy huy hiệu" }, { status: 404 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy học sinh" }, { status: 404 });

  const badge = await prisma.userBadge.upsert({
    where:  { userId_badgeId: { userId, badgeId } },
    create: { userId, badgeId, grantedBy: auth.userId },
    update: { grantedAt: new Date(), grantedBy: auth.userId },
  });

  return NextResponse.json(badge);
}

// DELETE — thu hồi badge
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_HONOR);
  if (isNextResponse(auth)) return auth;

  const { userId, badgeId } = await req.json();
  if (!userId || !badgeId) {
    return NextResponse.json({ error: "Thiếu userId hoặc badgeId" }, { status: 400 });
  }

  await prisma.userBadge.deleteMany({ where: { userId, badgeId } });
  return NextResponse.json({ ok: true });
}
