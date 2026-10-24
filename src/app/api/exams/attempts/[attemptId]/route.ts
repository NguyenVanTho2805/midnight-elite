import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { finalizeAttempt, applyAttemptOrder, loadAnswerState } from "@/lib/examGrading";
import { loadPublishState } from "@/lib/quizPublication";
import { resultVisibility } from "@/lib/quizRoom";

// GET /api/exams/attempts/[attemptId] — trạng thái attempt hiện tại (phục vụ resume)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { attemptId } = await params;

  try {
    let attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
    // 404 (không phải 403) để tránh lộ thông tin attempt có tồn tại hay không
    if (!attempt || attempt.userId !== session.userId) {
      return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    if (attempt.status === "in_progress" && attempt.expiresAt.getTime() <= Date.now()) {
      const finalized = await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
      if (finalized) attempt = finalized;
    }

    if (attempt.status !== "in_progress") {
      const examMeta = await prisma.exam.findUnique({ where: { id: attempt.examId }, select: { totalPoints: true } });
      // QZ-11: bài có tự luận chưa được gia sư công bố → không trả điểm dở dang; chỉ báo "đã ghi nhận, chờ chấm".
      const vis = resultVisibility(await loadPublishState(attempt.examId, session.userId), true);
      return NextResponse.json({
        attemptId: attempt.id,
        status: attempt.status,
        serverNow: new Date().toISOString(),
        submittedAt: attempt.submittedAt,
        score: vis.showScore ? attempt.score : null,
        pendingManual: vis.pendingManual,
        totalPoints: examMeta?.totalPoints ?? 150,
      });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: attempt.examId },
      include: {
        examQuestions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const { answers, textAnswers, boolAnswersByOption } = await loadAnswerState(attempt.id);
    const questions = applyAttemptOrder(exam.examQuestions, attempt);

    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      serverNow: new Date().toISOString(),
      expiresAt: attempt.expiresAt,
      sectionWindows: attempt.sectionWindows,
      questions,
      answers,
      textAnswers,
      boolAnswers: boolAnswersByOption,
      tabSwitchCount: attempt.tabSwitchCount ?? 0,
    });
  } catch (e) {
    console.error("[GET /api/exams/attempts/[attemptId]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
