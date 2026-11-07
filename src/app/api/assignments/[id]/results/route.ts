import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAssignmentAccess } from "@/lib/courseAccessServer";
import { anonymousStudentLabel } from "@/lib/courseAccess";

// GET /api/assignments/[id]/results — giáo viên xem % hoàn thiện + bài làm của
// TỪNG học viên đã ghi danh khoá học (kể cả học viên chưa mở bài — 0%), dùng
// để chấm tự luận (xem PATCH .../questions/[questionId]/grade). Không phụ
// thuộc locked/dueDate — giáo viên luôn xem được đáp án đúng của chính đề mình tạo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        ownerId: true, mode: true, dueDate: true,
        lesson: { select: { chapter: { select: { section: { select: { courseId: true } } } } } },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true, order: true, text: true, type: true, points: true,
            options: { orderBy: { order: "asc" }, select: { id: true, text: true, isCorrect: true } },
          },
        },
      },
    });
    if (!assignment) return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });

    // TUT-dong-giang: chủ lớp / quản trị / đồng giảng theo lớp chứa bài; bộ môn chỉ bài của mình hoặc nhóm của mình.
    const acc = await requireAssignmentAccess(assignmentId, "grade");
    if (!acc.ok) return acc.res;
    const auth = acc.session;

    if (assignment.mode !== "interactive") {
      return NextResponse.json({ error: "Bài tập này không phải kiểu làm trên web" }, { status: 400 });
    }

    const courseId = assignment.lesson.chapter.section.courseId;
    const [enrollments, answers] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId },
        select: { user: { select: { id: true, name: true, studentId: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.assignmentAnswer.findMany({
        where: { question: { assignmentId } },
        select: { userId: true, questionId: true, optionId: true, textAnswer: true, isCorrect: true, pointsAwarded: true, teacherComment: true },
      }),
    ]);

    const byUser = new Map<string, typeof answers>();
    for (const a of answers) {
      const list = byUser.get(a.userId);
      if (list) list.push(a); else byUser.set(a.userId, [a]);
    }

    const totalPoints = assignment.questions.reduce((s, q) => s + q.points, 0);
    // Giáo viên bộ môn xem bài NGOÀI nhóm mình: ẩn tên + mã học sinh (nhãn "Học viên N", xếp theo id để không lộ thứ tự chữ cái), vẫn chấm được qua userId.
    const rows = acc.namesVisible ? enrollments : [...enrollments].sort((a, b) => a.user.id.localeCompare(b.user.id));
    const students = rows.map(({ user }, idx) => {
      const mine = byUser.get(user.id) ?? [];
      const byQuestion = new Map(mine.map(a => [a.questionId, a]));
      let answered = 0, score = 0;
      const answersOut: Record<string, { optionId: string | null; textAnswer: string | null; isCorrect: boolean | null; pointsAwarded: number | null; teacherComment: string | null }> = {};
      for (const q of assignment.questions) {
        const a = byQuestion.get(q.id);
        const has = q.type === "MC" ? !!a?.optionId : !!a?.textAnswer;
        if (has) answered++;
        score += q.type === "ESSAY" ? (a?.pointsAwarded ?? 0) : (a?.isCorrect ? q.points : 0);
        if (a) {
          answersOut[q.id] = {
            optionId: a.optionId, textAnswer: a.textAnswer, isCorrect: a.isCorrect,
            pointsAwarded: a.pointsAwarded, teacherComment: a.teacherComment,
          };
        }
      }
      return {
        userId: user.id,
        name: acc.namesVisible ? user.name : anonymousStudentLabel(idx),
        studentId: acc.namesVisible ? user.studentId : null,
        completion: { answered, total: assignment.questions.length },
        score, answers: answersOut,
      };
    });

    return NextResponse.json({
      dueDate: assignment.dueDate, totalPoints,
      questions: assignment.questions,
      students,
    });
  } catch (e) {
    console.error("[GET /api/assignments/[id]/results]", assignmentId, e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
