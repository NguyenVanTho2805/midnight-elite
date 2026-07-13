import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// DELETE /api/exams/[id]/guest-access/[userId] — admin: thu hồi quyền thi đã duyệt
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId, userId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  try {
    await prisma.examGuestAccess.delete({ where: { userId_examId: { userId, examId } } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/exams/[id]/guest-access/[userId]]", e);
    return NextResponse.json({ error: "Thu hồi thất bại" }, { status: 400 });
  }
}
