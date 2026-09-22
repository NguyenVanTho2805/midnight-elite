import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";

// PATCH /api/parent-links/[id] — body { action: "verify" | "revoke" }
// verify: CHỈ học viên trong liên kết mới được xác nhận (không phải phụ huynh
// tự xác nhận cho chính mình).
// revoke: học viên, phụ huynh trong liên kết, hoặc admin có MANAGE_STUDENTS.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const { id } = await params;
  const { action } = await req.json();
  if (action !== "verify" && action !== "revoke") {
    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  }

  const link = await prisma.parentLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ error: "Không tìm thấy liên kết" }, { status: 404 });

  if (action === "verify") {
    if (session.userId !== link.studentId) {
      return NextResponse.json({ error: "Chỉ học viên trong liên kết mới được xác nhận" }, { status: 403 });
    }
    if (link.status !== "pending") {
      return NextResponse.json({ error: `Liên kết đang ở trạng thái ${link.status}, không thể xác nhận` }, { status: 409 });
    }

    const updated = await prisma.parentLink.update({
      where: { id },
      data:  { status: "verified", verifiedAt: new Date() },
    });

    await notify(link.parentId, {
      type:    "parent_link_verified",
      title:   "Liên kết phụ huynh đã được xác nhận",
      message: "Học viên đã xác nhận liên kết. Bạn có thể xem thông tin học tập của con.",
      link:    `/student/ho-so`,
    });
    await logAction(session.userId, "parent_link.verify", "ParentLink", id, {
      parentId: link.parentId, studentId: link.studentId,
    });

    return NextResponse.json(updated);
  }

  // revoke
  const isParty = session.userId === link.studentId || session.userId === link.parentId;
  const isAdmin = session.role === "admin" && checkPermission(session.adminRole, PERMISSIONS.MANAGE_STUDENTS);
  if (!isParty && !isAdmin) {
    return NextResponse.json({ error: "Bạn không có quyền thu hồi liên kết này" }, { status: 403 });
  }

  const updated = await prisma.parentLink.update({
    where: { id },
    data:  { status: "revoked" },
  });
  await logAction(session.userId, "parent_link.revoke", "ParentLink", id, {
    parentId: link.parentId, studentId: link.studentId, previousStatus: link.status,
  });

  return NextResponse.json(updated);
}
