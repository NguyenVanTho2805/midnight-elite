import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedResource, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/assignments/[id]/submissions — danh sách bài học viên đã nộp, để
// giáo viên chấm. Chỉ chủ sở hữu bài tập (hoặc admin_content/admin_super) xem được.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { ownerId: true } });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    const auth = await requireOwnedResource(PERMISSIONS.MANAGE_CURRICULUM, assignment.ownerId);
    if (isNextResponse(auth)) return auth;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { id: true, name: true, studentId: true } } },
    });

    return NextResponse.json(submissions);
  } catch (e) {
    console.error("[GET /api/assignments/[id]/submissions]", assignmentId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
