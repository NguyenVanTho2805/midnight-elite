import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssignmentAccess } from "@/lib/courseAccessServer";

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

    // TUT-dong-giang: chủ lớp / quản trị / đồng giảng theo lớp chứa bài; bộ môn chỉ bài của mình hoặc nhóm của mình.
    const acc = await requireAssignmentAccess(assignmentId, "grade");
    if (!acc.ok) return acc.res;
    const auth = acc.session;

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
