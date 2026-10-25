// QZ — hạn nộp riêng từng học sinh (phần chạm DB). Luật thuần: quizDeadline.ts. Quyền: CHỈ gia sư chủ đề (requireOwnedExam),
// và chỉ học sinh đang học trong lớp CỦA CHÍNH gia sư đó (đề gắn lớp, lớp do gia sư sở hữu). Học sinh ngoài lớp → 403, không lộ tên.
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { logChange } from "@/lib/quizServer";
import type { OwnedExam } from "@/lib/quizGradeServer";
import {
  DEADLINE_MAX_STUDENTS, deadlineLogNote, normalizeDeadlineNote, parseDueAt,
} from "@/lib/quizDeadline";

/** Học sinh đang học trong lớp của đề, nếu lớp đó của đúng gia sư này. Đề chưa gắn lớp / lớp của người khác → null (KiN chưa biết danh sách). */
export async function rosterOf(exam: OwnedExam, tutorId: string): Promise<{ userId: string; name: string }[] | null> {
  if (!exam.courseId) return null;
  const course = await prisma.course.findUnique({ where: { id: exam.courseId }, select: { ownerId: true } });
  if (!course || course.ownerId !== tutorId) return null;
  const enr = await prisma.enrollment.findMany({ where: { courseId: exam.courseId, status: "active" }, select: { userId: true, user: { select: { name: true } } }, take: 500 });
  return enr.map(e => ({ userId: e.userId, name: e.user?.name ?? "Học viên" })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function loadDeadlines(exam: OwnedExam, tutorId: string) {
  const roster = await rosterOf(exam, tutorId);
  const rows = await prisma.quizStudentDeadline.findMany({ where: { examId: exam.id }, take: 1000 });
  const by = new Map(rows.map(r => [r.userId, r]));
  return {
    enrolledKnown: roster !== null,
    shared: { date: exam.date, time: exam.time, duration: exam.duration },
    students: (roster ?? []).map(s => {
      const r = by.get(s.userId);
      return { userId: s.userId, name: s.name, dueAt: r?.dueAt.toISOString() ?? null, note: r?.note ?? null };
    }),
  };
}

export type DeadlineWrite = { ok: true; count: number } | { ok: false; status: number; error: string };

function idsFrom(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > DEADLINE_MAX_STUDENTS || raw.some(x => typeof x !== "string" || !x)) return null;
  return [...new Set(raw as string[])];
}

async function checkRoster(exam: OwnedExam, tutorId: string, ids: string[]): Promise<DeadlineWrite | null> {
  const roster = await rosterOf(exam, tutorId);
  if (roster === null) return { ok: false, status: 409, error: "Quiz này chưa gắn với lớp của cô nên chưa đặt hạn riêng được. Gắn lớp ở tab “Đáp án và phát hành” trước." };
  const ok = new Set(roster.map(r => r.userId));
  if (ids.some(id => !ok.has(id))) return { ok: false, status: 403, error: "Có học sinh không thuộc lớp của cô." };
  return null;
}

export async function setDeadlines(exam: OwnedExam, tutorId: string, body: { userIds?: unknown; dateKey?: unknown; time?: unknown; note?: unknown }, now = new Date()): Promise<DeadlineWrite> {
  const ids = idsFrom(body.userIds);
  if (!ids) return { ok: false, status: 400, error: `Chọn từ 1 đến ${DEADLINE_MAX_STUDENTS} học sinh.` };
  const due = parseDueAt(body.dateKey, body.time, now);
  if (!due.ok) return { ok: false, status: 400, error: due.error };
  const note = normalizeDeadlineNote(body.note);
  if (!note.ok) return { ok: false, status: 400, error: note.error };
  const bad = await checkRoster(exam, tutorId, ids);
  if (bad) return bad;

  const meta = await prisma.exam.findUnique({ where: { id: exam.id }, select: { rootExamId: true } });
  await prisma.$transaction(async tx => {
    for (const userId of ids) {
      await tx.quizStudentDeadline.upsert({
        where: { examId_userId: { examId: exam.id, userId } },
        create: { examId: exam.id, userId, dueAt: due.value, note: note.value, setById: tutorId },
        update: { dueAt: due.value, note: note.value, setById: tutorId },
      });
    }
    await logChange(tx, { examId: exam.id, rootExamId: meta?.rootExamId ?? null, actorId: tutorId, kind: "deadline", note: deadlineLogNote("set", ids.length, due.value) });
  });
  await logAction(tutorId, "quiz_deadline.set", "Exam", exam.id, { userIds: ids, dueAt: due.value.toISOString() });
  return { ok: true, count: ids.length };
}

export async function clearDeadlines(exam: OwnedExam, tutorId: string, body: { userIds?: unknown }): Promise<DeadlineWrite> {
  const ids = idsFrom(body.userIds);
  if (!ids) return { ok: false, status: 400, error: `Chọn từ 1 đến ${DEADLINE_MAX_STUDENTS} học sinh.` };
  const bad = await checkRoster(exam, tutorId, ids);
  if (bad) return bad;
  const meta = await prisma.exam.findUnique({ where: { id: exam.id }, select: { rootExamId: true } });
  let removed = 0;
  await prisma.$transaction(async tx => {
    const r = await tx.quizStudentDeadline.deleteMany({ where: { examId: exam.id, userId: { in: ids } } });
    removed = r.count;
    if (removed > 0) await logChange(tx, { examId: exam.id, rootExamId: meta?.rootExamId ?? null, actorId: tutorId, kind: "deadline", note: deadlineLogNote("clear", removed) });
  });
  if (removed > 0) await logAction(tutorId, "quiz_deadline.clear", "Exam", exam.id, { userIds: ids, removed });
  return { ok: true, count: removed };
}

/** Phía học sinh: hạn riêng của chính mình ở đề này (hoặc null). */
export async function getOwnDeadline(examId: string, userId: string): Promise<Date | null> {
  const r = await prisma.quizStudentDeadline.findUnique({ where: { examId_userId: { examId, userId } }, select: { dueAt: true } });
  return r?.dueAt ?? null;
}
