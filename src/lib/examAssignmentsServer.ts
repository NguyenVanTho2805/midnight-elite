// BU-04 — danh sách "Đề thi" của học sinh (GET /api/student/de-thi). Luật thuần: examRoomLib.assignmentState/sortAssignments, examWindow.
// Gồm: đề đang mở (active, đã phát hành, bản mới nhất) của lớp em đang học + đề em đã từng làm (đường link). Không có mã con, không tên học sinh khác,
// không đáp án, không giá. Điểm tốt nhất chỉ khi quyền xem điểm cho phép (đề giữ điểm chưa công bố → null).
import { prisma } from "@/lib/prisma";
import { isEnrollmentActive } from "@/lib/enrollment";
import { loadPublishStates } from "@/lib/quizPublication";
import { effectiveExamPolicy } from "@/lib/examPolicy";
import { resultVisibility } from "@/lib/quizRoom";
import { heldAttemptIdsAmong } from "@/lib/examHold";
import { assignmentState, sortAssignments } from "@/lib/examRoomLib";
import { durationMinutesOf, examWindowOf, windowState } from "@/lib/examWindow";
import type { AssignmentItem, ExamMode } from "@/lib/examRoomApi";

const MAX_ITEMS = 200;

export async function listStudentAssignments(userId: string, now: Date): Promise<AssignmentItem[]> {
  const [enrollments, myAttempts] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId }, select: { courseId: true, status: true } }),
    prisma.examAttempt.findMany({ where: { userId }, select: { id: true, examId: true, status: true, expiresAt: true } }),
  ]);
  const courseIds = enrollments.filter(e => isEnrollmentActive(e)).map(e => e.courseId);

  // Đề em đã từng làm có thể là MÃ CON → quy về gốc.
  const attemptedExamIds = [...new Set(myAttempts.map(a => a.examId))];
  const attemptedExams = attemptedExamIds.length ? await prisma.exam.findMany({ where: { id: { in: attemptedExamIds } }, select: { id: true, variantOfId: true } }) : [];
  const attemptedRootIds = [...new Set(attemptedExams.map(e => e.variantOfId ?? e.id))];

  const exams = await prisma.exam.findMany({
    where: {
      isDraft: false, supersededById: null, variantOfId: null,
      OR: [
        ...(courseIds.length ? [{ active: true, courseId: { in: courseIds } }] : []),
        ...(attemptedRootIds.length ? [{ id: { in: attemptedRootIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    include: { _count: { select: { examQuestions: true } }, course: { select: { name: true } }, owner: { select: { adminRole: true } } },
  });
  if (exams.length === 0) return [];
  const rootIds = exams.map(e => e.id);

  const children = await prisma.exam.findMany({ where: { variantOfId: { in: rootIds } }, select: { id: true, variantOfId: true } });
  const rootOf = new Map<string, string>(children.map(c => [c.id, c.variantOfId as string]));
  for (const id of rootIds) rootOf.set(id, id);
  const groupAttempts = myAttempts.filter(a => rootOf.has(a.examId));

  const [limits, deadlines, results, states, held] = await Promise.all([
    prisma.quizAttemptLimit.findMany({ where: { examId: { in: rootIds } }, select: { examId: true, maxAttempts: true } }),
    prisma.quizStudentDeadline.findMany({ where: { userId, examId: { in: rootIds } }, select: { examId: true, dueAt: true } }),
    prisma.examResult.findMany({ where: { userId, examId: { in: rootIds } }, select: { examId: true, score: true, totalPoints: true } }),
    loadPublishStates(rootIds, userId),
    heldAttemptIdsAmong(groupAttempts.filter(a => a.status !== "in_progress").map(a => ({ id: a.id, examId: a.examId }))),
  ]);
  const limitOf = new Map(limits.map(l => [l.examId, l]));
  const dueOf = new Map(deadlines.map(d => [d.examId, d.dueAt]));
  const resultOf = new Map(results.map(r => [r.examId, r]));

  const items: AssignmentItem[] = exams.map(e => {
    const mine = groupAttempts.filter(a => rootOf.get(a.examId) === e.id);
    const inProgress = mine.some(a => a.status === "in_progress" && a.expiresAt.getTime() > now.getTime());
    const pendingPublish = mine.some(a => held.has(a.id));
    const mode: ExamMode | null = e.mode === "practice" || e.mode === "test" ? e.mode : null;
    const win = examWindowOf(e);
    const ownDue = dueOf.get(e.id) ?? null;
    let ws = windowState(mode, e, now);
    if (!inProgress && ownDue && ownDue.getTime() <= now.getTime()) ws = "closed"; // hạn riêng đã qua: không bắt đầu lượt mới
    // STU-001: số lượt HIỆU LỰC (đề công khai chưa chỉnh gì → 2 lượt), cùng nguồn với cổng vào đề và start.
    const max = effectiveExamPolicy(e, limitOf.get(e.id) ?? null, { now }).maxAttempts;
    const state = assignmentState({ inProgress, used: mine.length, max, pendingPublish, windowState: ws, active: e.active, mode });

    const vis = resultVisibility(states.get(e.id) ?? { hasEssay: false, published: true }, true);
    const r = resultOf.get(e.id);
    const best = r && vis.showScore && !inProgress && !pendingPublish ? { score: r.score, total: r.totalPoints } : null;

    const source: AssignmentItem["source"] = e.courseId ? "lop" : e.owner?.adminRole === "teacher" ? "link" : "thu-vien";
    return {
      id: e.id, title: e.title, mode, source, courseName: e.course?.name ?? null,
      opensAt: mode === "test" ? win.opensAt?.toISOString() ?? null : null,
      dueAt: (ownDue ?? (mode === "test" ? win.closesAt : null))?.toISOString() ?? null,
      state, attempts: { used: mine.length, max },
      best, questionCount: e._count.examQuestions, durationMinutes: e.duration ? durationMinutesOf(e.duration) : null,
    };
  });
  return sortAssignments(items);
}
