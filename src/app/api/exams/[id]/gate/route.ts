import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isEnrollmentActive } from "@/lib/enrollment";
import { parseDurationMinutes } from "@/lib/examGrading";
import { hasExamPassword } from "@/lib/examPassword";
import { getMaxAttempts } from "@/lib/quizPublication";
import { attemptCounterLabel, attemptsGate } from "@/lib/quizRoom";
import { canStartByDeadline, deadlineState } from "@/lib/quizDeadline";
import { getOwnDeadline } from "@/lib/quizDeadlineServer";

// GET /api/exams/[id]/gate — "cổng vào đề" (QZ-11): thông tin để học sinh biết mình vào được không TRƯỚC khi bấm bắt đầu.
// KHÔNG trả câu hỏi, đáp án, mật khẩu hay băm. Quy tắc vào đề giống hệt POST /api/exams/[id]/start (máy chủ vẫn kiểm lại ở đó).
// blockReason: not_enrolled (đề gắn lớp, em chưa vào lớp → dẫn tới "nhập mã lớp"), payment_required, attempts_exhausted, no_questions, past_deadline (hạn nộp riêng của em đã qua).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id: examId } = await params;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examQuestions: true } }, course: { select: { id: true, name: true, owner: { select: { name: true } } } } },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    let blockReason: "not_enrolled" | "payment_required" | "attempts_exhausted" | "no_questions" | "past_deadline" | null = null;
    let enrolled: boolean | null = null;
    if (exam.courseId) {
      enrolled = isEnrollmentActive(await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: exam.courseId } } }));
      if (!enrolled) {
        if (exam.price && exam.price > 0) {
          const granted = await prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId: session.userId, examId } } });
          if (!granted) blockReason = "payment_required";
        } else blockReason = "not_enrolled";
      }
    }

    const [used, inProgress, max, essayCount] = await Promise.all([
      prisma.examAttempt.count({ where: { userId: session.userId, examId } }),
      prisma.examAttempt.findFirst({ where: { userId: session.userId, examId, status: "in_progress" }, select: { id: true, expiresAt: true } }),
      getMaxAttempts(examId),
      prisma.examQuestion.count({ where: { examId, type: "ESSAY" } }),
    ]);
    // Lượt dở đã quá hạn thì không còn là "đang làm" (máy chủ sẽ chấm nó khi học sinh bấm vào) — vẫn tính là đã dùng.
    const resumable = !!inProgress && inProgress.expiresAt.getTime() > Date.now();
    const gate = attemptsGate({ used, max, hasInProgress: resumable });
    if (exam._count.examQuestions === 0) blockReason = blockReason ?? "no_questions";
    else if (!gate.canStart) blockReason = blockReason ?? "attempts_exhausted";

    // Hạn nộp riêng của chính học sinh này (gia sư đặt). Quá hạn và chưa có lượt dở → không vào được. Không trả hạn của ai khác.
    const ownDue = await getOwnDeadline(examId, session.userId);
    if (!canStartByDeadline(ownDue, new Date(), resumable)) blockReason = blockReason ?? "past_deadline";

    return NextResponse.json({
      deadline: ownDue ? { dueAt: ownDue.toISOString(), state: deadlineState(ownDue, new Date()) } : null,
      exam: {
        id: exam.id, title: exam.title, category: exam.category, date: exam.date, time: exam.time,
        durationMinutes: parseDurationMinutes(exam.duration), questionCount: exam._count.examQuestions,
        hasPassword: hasExamPassword(exam), hasEssay: essayCount > 0, hasQuestions: exam._count.examQuestions > 0,
      },
      klass: exam.course ? { id: exam.course.id, name: exam.course.name, tutorName: exam.course.owner?.name ?? null } : null,
      enrolled,
      attempts: { used, max, remaining: gate.remaining, resumable, label: attemptCounterLabel(used, max, resumable) },
      canStart: blockReason === null,
      blockReason,
      serverNow: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/exams/[id]/gate]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
