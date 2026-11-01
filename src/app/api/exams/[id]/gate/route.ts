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
import { examHolds } from "@/lib/examHold";
import { isExamMode } from "@/lib/deThiAssign";
import { examWindowOf, windowState } from "@/lib/examWindow";
import { practicePolicy } from "@/lib/examPracticeLib";
import { countGroupAttempts, findInProgressInGroup, loadGroup } from "@/lib/examVariantServer";
import type { BlockReason } from "@/lib/examRoomApi";

// GET /api/exams/[id]/gate — "cổng vào đề" (QZ-11, BU-04): thông tin để học sinh biết mình vào được không TRƯỚC khi bấm bắt đầu.
// KHÔNG trả câu hỏi, đáp án, mật khẩu hay băm, mã đề (variantNo), id mã con. Quy tắc vào đề giống hệt POST /api/exams/[id]/start (máy chủ kiểm lại ở đó).
// Id mã con được quy về đề gốc. Thứ tự blockReason: no_questions > not_enrolled/payment_required > closed/not_open > attempts_exhausted > past_deadline.
// Có lượt đang làm còn hạn → vào tiếp được dù cửa sổ đã đóng / hết lượt / quá hạn riêng.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id: requestedId } = await params;
  try {
    const group = await loadGroup(requestedId);
    if (!group) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    const examId = group.rootId;
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examQuestions: true } }, course: { select: { id: true, name: true, owner: { select: { name: true } } } } },
    });
    if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
    // Bản nháp chỉ quản trị / gia sư thấy; học sinh nhận 404 (không lộ tên bản nháp).
    if (exam.isDraft && session.role !== "admin") return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const [used, inProgress, max, essayCount, ownDue, held] = await Promise.all([
      countGroupAttempts(session.userId, group.ids),
      findInProgressInGroup(session.userId, group.ids),
      getMaxAttempts(examId),
      prisma.examQuestion.count({ where: { examId, type: "ESSAY" } }),
      getOwnDeadline(examId, session.userId),
      examHolds(prisma, examId),
    ]);
    // Phiên bản cũ đã bị thay: học sinh chưa có lượt nào thì không thấy (đề vẫn tồn tại cho người đã làm).
    if (exam.supersededById && used === 0 && session.role !== "admin") return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

    const now = new Date();
    const mode = isExamMode(exam.mode) ? exam.mode : null;
    const win = windowState(mode, exam, now);
    const w = examWindowOf(exam);

    let blockReason: BlockReason | null = null;
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

    // Lượt dở đã quá hạn thì không còn là "đang làm" (máy chủ sẽ chấm nó khi học sinh bấm vào) — vẫn tính là đã dùng.
    const resumable = !!inProgress && inProgress.expiresAt.getTime() > now.getTime();
    const gate = attemptsGate({ used, max, hasInProgress: resumable });
    if (exam._count.examQuestions === 0) blockReason = blockReason ?? "no_questions";
    if (!resumable) {
      if (!exam.active || win === "closed") blockReason = blockReason ?? "closed";
      else if (win === "not_open") blockReason = blockReason ?? "not_open";
      if (!gate.canStart) blockReason = blockReason ?? "attempts_exhausted";
    }
    // Hạn nộp riêng của chính học sinh này (gia sư đặt). Quá hạn và chưa có lượt dở → không vào được. Không trả hạn của ai khác.
    if (!canStartByDeadline(ownDue, now, resumable)) blockReason = blockReason ?? "past_deadline";

    return NextResponse.json({
      deadline: ownDue ? { dueAt: ownDue.toISOString(), state: deadlineState(ownDue, now) } : null,
      exam: {
        id: exam.id, title: exam.title, category: exam.category, date: exam.date, time: exam.time,
        durationMinutes: parseDurationMinutes(exam.duration), questionCount: exam._count.examQuestions,
        hasPassword: hasExamPassword(exam), hasEssay: essayCount > 0, hasQuestions: exam._count.examQuestions > 0,
        mode,
      },
      window: { state: win, opensAt: win === "none" ? null : w.opensAt?.toISOString() ?? null, closesAt: win === "none" ? null : w.closesAt?.toISOString() ?? null },
      feedback: practicePolicy({ mode, answerVisibility: exam.answerVisibility, hideAnswerForWrong: exam.hideAnswerForWrong }, held).feedback,
      klass: exam.course ? { id: exam.course.id, name: exam.course.name, tutorName: exam.course.owner?.name ?? null } : null,
      enrolled,
      attempts: { used, max, remaining: gate.remaining, resumable, label: attemptCounterLabel(used, max, resumable) },
      canStart: blockReason === null,
      blockReason,
      serverNow: now.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/exams/[id]/gate]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
