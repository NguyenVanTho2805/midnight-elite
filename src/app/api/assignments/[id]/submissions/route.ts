import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssignmentAccess } from "@/lib/courseAccessServer";
import { anonymousStudentLabel } from "@/lib/courseAccess";

// GET /api/assignments/[id]/submissions — danh sách bài học viên đã nộp, để
// giáo viên chấm. Chỉ chủ sở hữu bài tập (hoặc admin_content/admin_super) xem được.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    // TUT-dong-giang: chủ lớp / quản trị / đồng giảng theo lớp chứa bài; bộ môn chỉ bài của mình hoặc nhóm của mình.
    const acc = await requireAssignmentAccess(assignmentId, "grade");
    if (!acc.ok) return acc.res;
    const auth = acc.session;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      orderBy: { submittedAt: "desc" },
      include: { user: { select: { id: true, name: true, studentId: true } } },
    });

    if (acc.namesVisible) return NextResponse.json(submissions);
    // Bộ môn ngoài nhóm: ẩn tên + mã học sinh, nhãn băm ổn định theo mã người nộp (không theo thứ tự danh sách).
    return NextResponse.json(submissions.map(x => ({ ...x, user: { id: x.user.id, name: anonymousStudentLabel(x.userId), studentId: null } })));
  } catch (e) {
    console.error("[GET /api/assignments/[id]/submissions]", assignmentId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
