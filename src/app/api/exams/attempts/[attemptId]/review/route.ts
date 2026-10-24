import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { orderQuestionsAndOptionsFull, loadAnswerState, hasExamWindowEnded } from "@/lib/examGrading";
import { correctionSummary } from "@/lib/examCorrectionServer";
import { isAttemptHeld } from "@/lib/examHold";

// GET /api/exams/attempts/[attemptId]/review — học viên: xem lại bài làm của
// chính mình sau khi đã nộp (điểm từng câu, đáp án đúng nếu đề cho phép xem).
// Tôn trọng 2 cấu hình của đề: answerVisibility (khi nào được xem đáp án) và
// hideAnswerForWrong (câu trả lời sai chỉ hiện "Sai", không lộ đáp án đúng).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    // 404 (không phải 403) để tránh lộ thông tin attempt có tồn tại hay không
    if (!attempt || attempt.userId !== session.userId) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }
    if (attempt.status === "in_progress") {
      return NextResponse.json({ error: "Bài thi chưa nộp" }, { status: 409 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: attempt.examId } });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    // QZ-08: đề giữ điểm đến khi gia sư công bố → chưa có điểm tổng, chưa có điểm/nhận xét tự luận, chưa có đáp án.
    const held = await isAttemptHeld(prisma, attempt);
    const canSeeAnswers = held ? false :
      exam.answerVisibility === "after_submit" ? true :
      exam.answerVisibility === "after_exam_ends" ? hasExamWindowEnded(exam) :
      false; // "never"

    const examQuestions = await prisma.examQuestion.findMany({
      where: { examId: exam.id },
      orderBy: { order: "asc" },
      include: { options: { orderBy: { order: "asc" } } },
    });
    const orderedQuestions = orderQuestionsAndOptionsFull(examQuestions, attempt);

    const { answers, textAnswers, boolAnswersByOption } = await loadAnswerState(attemptId);
    const essayAnswers = await prisma.examAnswer.findMany({
      where: { attemptId, question: { type: "ESSAY" } },
      select: { questionId: true, pointsAwarded: true, teacherComment: true },
    });
    const essayByQuestion = new Map(essayAnswers.map(a => [a.questionId, a]));

    // NV-188: câu làm sai chưa chữa xong → giấu đáp án/lời giải ở màn này (xem examCorrectionServer.correctionSummary).
    const { correctableCount, pendingIds } = await correctionSummary(session.userId, attemptId);

    const questions = orderedQuestions.map(q => {
      if (q.type === "ESSAY") {
        const graded = essayByQuestion.get(q.id);
        return {
          id: q.id, type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel,
          textAnswer: textAnswers[q.id] ?? null,
          pointsAwarded: held ? null : graded?.pointsAwarded ?? null,
          teacherComment: held ? null : graded?.teacherComment ?? null,
        };
      }

      if (q.type === "TRUE_FALSE_CLUSTER") {
        const options = q.options.map(o => {
          const studentAnswerTrue = boolAnswersByOption[o.id] ?? null;
          const wasCorrect = studentAnswerTrue !== null && studentAnswerTrue === o.isCorrect;
          const reveal = canSeeAnswers && (!exam.hideAnswerForWrong || wasCorrect);
          return {
            id: o.id, text: o.text, subLabel: o.subLabel,
            studentAnswerTrue,
            isCorrect: reveal ? o.isCorrect : null,
          };
        });
        return { id: q.id, type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel, options };
      }

      if (q.type === "SHORT_ANSWER") {
        const studentAnswer = textAnswers[q.id] ?? null;
        const correctOption = q.options.find(o => o.isCorrect);
        const normalize = (s: string) => s.trim().toLowerCase().replace(/,/g, ".");
        const wasCorrect = !!studentAnswer?.trim() && !!correctOption && normalize(studentAnswer) === normalize(correctOption.text);
        const pendingFix = pendingIds.has(q.id);
        const reveal = canSeeAnswers && (!exam.hideAnswerForWrong || wasCorrect) && !pendingFix;
        return {
          id: q.id, type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel,
          studentAnswer,
          correctAnswer: reveal ? (correctOption?.text ?? null) : null,
          isCorrect: reveal ? wasCorrect : null,
          correctionPending: pendingFix,
        };
      }

      // MC
      const studentOptionId = answers[q.id] ?? null;
      const chosenOption = q.options.find(o => o.id === studentOptionId);
      const wasCorrect = !!chosenOption?.isCorrect;
      const pendingFix = pendingIds.has(q.id);
      const reveal = canSeeAnswers && (!exam.hideAnswerForWrong || wasCorrect) && !pendingFix;
      return {
        id: q.id, type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel,
        correctionPending: pendingFix,
        studentOptionId,
        options: q.options.map(o => ({
          id: o.id, text: o.text,
          isCorrect: reveal ? o.isCorrect : null,
        })),
        explanation: reveal ? q.explanation : null,
      };
    });

    return NextResponse.json({
      attemptId: attempt.id,
      score: held ? null : attempt.score,
      held,
      totalPoints: exam.totalPoints,
      canSeeAnswers,
      // NV-188: số câu làm sai có thể chữa (0 nếu đề không cho xem đáp án / đang ẩn đáp án câu sai).
      correctableCount,
      questions,
    });
  } catch (e) {
    console.error("[GET /api/exams/attempts/[attemptId]/review]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
