import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exams/attempts/[attemptId]/admin — giáo viên/admin: chi tiết 1 lượt
// thi kèm toàn bộ câu trả lời (kể cả tự luận, để chấm tay ở Giai đoạn 6).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });

    const exam = await prisma.exam.findUnique({ where: { id: attempt.examId }, select: { ownerId: true } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    if (!ownsResource(auth, exam.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
    }

    const questions = await prisma.examQuestion.findMany({
      where: { examId: attempt.examId },
      orderBy: { order: "asc" },
      include: { options: { orderBy: { order: "asc" } } },
    });

    const [answers, boolAnswers] = await Promise.all([
      prisma.examAnswer.findMany({ where: { attemptId } }),
      prisma.examAnswerBoolean.findMany({ where: { attemptId } }),
    ]);
    const answerByQuestion = new Map(answers.map(a => [a.questionId, a]));
    const boolAnswerByOption = new Map(boolAnswers.map(a => [a.optionId, a.answerTrue]));

    const result = questions.map(q => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: q.options.map(o => ({
        id: o.id, text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel,
        studentAnswerTrue: boolAnswerByOption.get(o.id) ?? null,
      })),
      studentOptionId: answerByQuestion.get(q.id)?.optionId ?? null,
      textAnswer: answerByQuestion.get(q.id)?.textAnswer ?? null,
      pointsAwarded: answerByQuestion.get(q.id)?.pointsAwarded ?? null,
      teacherComment: answerByQuestion.get(q.id)?.teacherComment ?? null,
    }));

    return NextResponse.json({
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      totalPoints: 150,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      tabSwitchCount: attempt.tabSwitchCount,
      user: attempt.user,
      questions: result,
    });
  } catch (e) {
    console.error("[GET /api/exams/attempts/[attemptId]/admin]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
