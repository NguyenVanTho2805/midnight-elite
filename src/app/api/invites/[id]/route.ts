// BE-066 (1.4.6) — DELETE /api/invites/[id] = thu hồi mã mời.
// Không xóa hẳn: set `revoked = true` để giữ lịch sử (ai tạo, bao giờ, dùng
// mấy lượt). Sau đó mã này không redeem được nữa.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { invites } from "@/lib/classInvite";
import { logAction } from "@/lib/auditLog";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const inv = await invites().findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Không tìm thấy mã mời" }, { status: 404 });

  const course = await prisma.course.findUnique({ where: { id: inv.courseId }, select: { ownerId: true } });
  if (!course) return NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 });
  if (!ownsResource(auth, course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 });
  }

  if (inv.revoked) {
    // Idempotent — gọi 2 lần vẫn 200, không ghi audit 2 lần.
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await invites().update({ where: { id }, data: { revoked: true } });
  await logAction(auth.userId, "class_invite.revoke", "ClassInvite", id, {
    courseId: inv.courseId, code: inv.code, usedCount: inv.usedCount,
  });
  return NextResponse.json({ ok: true });
}
