// PH-212 — mở khoá hồ sơ công khai của gia sư (sau khi xem xét lại).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";

export async function DELETE(_req: Request, { params }: { params: Promise<{ tutorId: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { tutorId } = await params;
  const r = await prisma.user.updateMany({ where: { id: tutorId, profileLockedAt: { not: null } }, data: { profileLockedAt: null, profileLockReason: null } });
  if (r.count === 0) return NextResponse.json({ ok: true, alreadyUnlocked: true });
  await logAction(auth.userId, "profile_lock.remove", "User", tutorId, {});
  return NextResponse.json({ ok: true });
}
