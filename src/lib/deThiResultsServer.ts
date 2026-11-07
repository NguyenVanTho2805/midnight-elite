// BU-03 P3 — phần CÓ DB của kết quả đề: nạp các hàng của đề gốc + mã đề con, đưa qua deThiResults.ts (thuần) / deThiResultsXlsx.ts.
// Quyền (Q1/Q2) do route gác bằng requireTutor(); ở đây: đề không có → 404, của gia sư khác → 403, id mã đề con → 400 IS_VARIANT.
// CHỈ `loadBangDiem` và `loadXlsx` đọc tên học sinh; `loadKetQua` không chọn cột tên nào. Giám sát rời màn hình: chỉ ĐỌC tabSwitchCount.
import { prisma } from "@/lib/prisma";
import { tutorMayAssignToCourse } from "@/lib/courseAccessServer";
import type { Fail, Outcome } from "@/lib/deThiServer";
import { RESULTS_MAX_ATTEMPTS, capRows, buildKetQua, buildScoreTable, type Chon, type KetQua, type ResultsInput, type ScoreRow } from "@/lib/deThiResults";
import { resultsXlsx, resultsXlsxFilename } from "@/lib/deThiResultsXlsx";

const fail = (status: number, error: string, code?: string): Fail => ({ ok: false, status, error, ...(code ? { code } : {}) });

async function loadInput(tutorId: string, examId: string): Promise<Outcome<{ input: ResultsInput; title: string; userIds: string[]; truncated: boolean }>> {
  const root = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, ownerId: true, title: true, totalPoints: true, variantOfId: true, courseId: true } });
  if (!root) return fail(404, "Không tìm thấy đề này.");
  if (root.ownerId !== tutorId) return fail(403, "Đề này không thuộc lớp của cô.");
  // TUT-dong-giang: đề gắn lớp ⇒ tác giả phải CÒN là chủ lớp / đồng giảng đang hiệu lực (bị gỡ hoặc đổi sang bộ môn ⇒ 403, không lộ tên + điểm).
  if (root.courseId && !(await tutorMayAssignToCourse(tutorId, root.courseId))) return fail(403, "Cô không còn dạy lớp của đề này nên không xem được kết quả.");
  if (root.variantOfId) return { ...fail(400, "Đây là mã đề con. Xem kết quả ở đề gốc.", "IS_VARIANT"), extra: { variantOfId: root.variantOfId } };
  const kids = await prisma.exam.findMany({ where: { variantOfId: examId }, select: { id: true, variantNo: true, totalPoints: true }, orderBy: { variantNo: "asc" } });
  const exams = [{ id: root.id, variantNo: 1, totalPoints: root.totalPoints }, ...kids.map(k => ({ id: k.id, variantNo: k.variantNo ?? 0, totalPoints: k.totalPoints }))];
  const examIds = exams.map(e => e.id);
  const [questions, attemptsRaw] = await Promise.all([
    prisma.examQuestion.findMany({ where: { examId: { in: examIds } }, orderBy: { order: "asc" }, select: { id: true, examId: true, order: true, type: true, points: true, text: true, options: { orderBy: { order: "asc" }, select: { id: true, text: true, isCorrect: true, subLabel: true } } } }),
    prisma.examAttempt.findMany({ where: { examId: { in: examIds } }, orderBy: { startedAt: "asc" }, take: RESULTS_MAX_ATTEMPTS + 1, select: { id: true, userId: true, examId: true, status: true, score: true, totalPoints: true, tabSwitchCount: true, startedAt: true, submittedAt: true } }),
  ]);
  const { rows: attempts, truncated } = capRows(attemptsRaw, RESULTS_MAX_ATTEMPTS);
  const attemptIds = attempts.map(a => a.id);
  const [answers, booleans] = attemptIds.length
    ? await Promise.all([
        prisma.examAnswer.findMany({ where: { attemptId: { in: attemptIds } }, select: { attemptId: true, questionId: true, optionId: true, textAnswer: true, pointsAwarded: true } }),
        prisma.examAnswerBoolean.findMany({ where: { attemptId: { in: attemptIds } }, select: { attemptId: true, optionId: true, answerTrue: true } }),
      ])
    : [[], []];
  return { ok: true, truncated, title: root.title, userIds: [...new Set(attempts.map(a => a.userId))], input: { exams, questions, attempts, answers, booleans } };
}

/** 5 khối — KHÔNG tên học sinh. Chưa có lượt nộp → số liệu rỗng (vẫn 200). */
export async function loadKetQua(tutorId: string, examId: string): Promise<Outcome<{ ketQua: KetQua }>> {
  const r = await loadInput(tutorId, examId);
  if (!r.ok) return r;
  return { ok: true, ketQua: { ...buildKetQua(r.input), truncated: r.truncated } };
}

async function namesOf(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  return new Map(users.map(u => [u.id, u.name] as const));
}

/** Bảng điểm — CÓ TÊN, chỉ gia sư chủ đề. */
export async function loadBangDiem(tutorId: string, examId: string, chon: Chon): Promise<Outcome<{ rows: ScoreRow[]; truncated: boolean }>> {
  const r = await loadInput(tutorId, examId);
  if (!r.ok) return r;
  return { ok: true, truncated: r.truncated, rows: buildScoreTable({ ...r.input, names: await namesOf(r.userIds) }, chon) };
}

export async function loadXlsx(tutorId: string, examId: string, chon: Chon): Promise<Outcome<{ bytes: Uint8Array; filename: string }>> {
  const r = await loadInput(tutorId, examId);
  if (!r.ok) return r;
  const rows = buildScoreTable({ ...r.input, names: await namesOf(r.userIds) }, chon);
  const bytes = await resultsXlsx({ title: r.title, chon, ketQua: buildKetQua(r.input), rows });
  return { ok: true, bytes, filename: resultsXlsxFilename(examId, new Date()) };
}
