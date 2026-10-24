// QZ-04 / QZ-05 / QZ-07 — phần CÓ DB của việc gia sư soạn quiz, nhập đề và phiên bản. Phần luật thuần: quizQuestion.ts, quizVersion.ts.
// Mọi hàm ở đây giả định người gọi đã qua requireTutor(); quyền theo từng đề kiểm ở loadOwnedQuiz (đề của gia sư khác → 403, không có → 404).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { computeExamStatus } from "@/lib/examData";
import { parseDurationMinutes } from "@/lib/examGrading";
import { vnDateKeyOf, isValidDateKey } from "@/lib/classSessions";
import { rootIdOf, canEditInPlace, type SnapQuestion } from "@/lib/quizVersion";
import type { QuizQuestionInput } from "@/lib/quizQuestion";

export type Tx = Prisma.TransactionClient;
export const QUIZ_CATEGORY = "Quiz";
export const HAS_ATTEMPTS_CODE = "HAS_ATTEMPTS";

/** "2026-10-24" → "24/10/2026" (định dạng Exam.date). */
export function dmyFromKey(key: string): string { const [y, m, d] = key.split("-"); return `${d}/${m}/${y}`; }
/** "24/10/2026" → "2026-10-24", sai định dạng / ngày không có thật → null. */
export function keyFromDmy(dmy: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dmy ?? "").trim());
  if (!m) return null;
  const key = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDateKey(key) ? key : null;
}
export const durationText = (min: number): string => `${min} phút`;
export const todayKeyVN = (): string => vnDateKeyOf(new Date());

export function newExamId(): string { return `quiz-${randomUUID()}`; }

export async function newExamCode(tx: Tx = prisma): Promise<string> {
  const count = await tx.exam.count({ where: { code: { startsWith: "QZ." } } });
  for (let i = 0; i < 50; i++) {
    const code = `QZ.${String(count + 1 + i).padStart(2, "0")}`;
    if (!(await tx.exam.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Không tạo được mã quiz duy nhất");
}

export async function logChange(tx: Tx, e: { examId: string; rootExamId: string | null; actorId: string; kind: string; note?: string | null }) {
  await tx.examChangeLog.create({ data: { examId: e.examId, rootExamId: e.rootExamId, actorId: e.actorId, kind: e.kind, note: e.note ?? null } });
}

/** Giữ cột `questions` (số câu) và `totalPoints` (thang điểm hiển thị) khớp với các câu hiện có. Quiz của gia sư dùng tổng điểm = tổng điểm các câu (không có thang 150). */
export async function syncQuizTotals(tx: Tx, examId: string): Promise<{ count: number; total: number }> {
  const agg = await tx.examQuestion.aggregate({ where: { examId }, _count: { _all: true }, _sum: { points: true } });
  const count = agg._count._all, total = Math.round((agg._sum.points ?? 0) * 100) / 100;
  await tx.exam.update({ where: { id: examId }, data: { questions: count, totalPoints: total > 0 ? total : 10 } });
  return { count, total };
}

export async function countAttempts(examId: string): Promise<number> {
  return prisma.examAttempt.count({ where: { examId } });
}

export type OwnedQuiz = NonNullable<Awaited<ReturnType<typeof prisma.exam.findUnique>>>;

/** Đề của đúng gia sư này. Không có → 404; của gia sư khác → 403. */
export async function loadOwnedQuiz(tutorId: string, examId: string): Promise<{ exam: OwnedQuiz; attemptCount: number } | NextResponse> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy quiz này." }, { status: 404 });
  if (exam.ownerId !== tutorId) return NextResponse.json({ error: "Quiz này không thuộc lớp của cô." }, { status: 403 });
  return { exam, attemptCount: await countAttempts(examId) };
}

/** Chặn sửa nội dung khi đã có lượt làm: trả 409 kèm mã để giao diện đưa gia sư sang "Tạo phiên bản mới". */
export function blockIfHasAttempts(attemptCount: number): NextResponse | null {
  if (canEditInPlace(attemptCount)) return null;
  return NextResponse.json({
    error: "Quiz này đã có học sinh làm nên KiN không sửa đè. Tạo phiên bản mới để chỉnh; bài đã làm và điểm cũ giữ nguyên.",
    code: HAS_ATTEMPTS_CODE,
  }, { status: 409 });
}

/** Gia sư có sở hữu lớp này không (Course.ownerId). Lớp của người khác / không có → false. */
export async function tutorOwnsCourse(tutorId: string, courseId: string): Promise<boolean> {
  const c = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  return !!c && c.ownerId === tutorId;
}

// ── Câu hỏi ───────────────────────────────────────────────────────────────────────────────────────
const rubricValue = (r: unknown) => (Array.isArray(r) && r.length ? (r as Prisma.InputJsonValue) : Prisma.DbNull);

function questionFields(q: QuizQuestionInput | SnapQuestion) {
  return {
    type: q.type, text: q.text.trim(), points: q.points,
    imageUrl: q.imageUrl?.trim() || null,
    explanation: q.explanation?.trim() || null,
    hint: q.hint?.trim() || null,
    studentGuide: q.studentGuide?.trim() || null,
    graderGuide: q.graderGuide?.trim() || null,
    rubric: rubricValue(q.rubric),
    sectionLabel: q.sectionLabel?.trim() || null,
  };
}
const optionRows = (q: QuizQuestionInput | SnapQuestion) =>
  q.options.map((o, idx) => ({ id: `eo-${randomUUID()}`, order: idx, text: o.text.trim(), isCorrect: !!o.isCorrect, subLabel: o.subLabel ?? null }));

export function questionCreateData(examId: string, q: QuizQuestionInput | SnapQuestion, order: number): Prisma.ExamQuestionUncheckedCreateInput {
  return { id: `eq-${randomUUID()}`, examId, order, ...questionFields(q), options: { create: optionRows(q) } };
}
/** Dữ liệu sửa tại chỗ (giữ id câu và truy vết ngân hàng câu hỏi): xoá lựa chọn cũ rồi dựng lựa chọn mới trong cùng giao dịch. */
export function questionUpdateData(q: QuizQuestionInput | SnapQuestion): Prisma.ExamQuestionUpdateInput {
  return { ...questionFields(q), options: { create: optionRows(q) } };
}

export async function appendQuestions(tx: Tx, examId: string, qs: (QuizQuestionInput | SnapQuestion)[]): Promise<void> {
  const max = await tx.examQuestion.aggregate({ where: { examId }, _max: { order: true } });
  let order = (max._max.order ?? 0) + 1;
  for (const q of qs) await tx.examQuestion.create({ data: questionCreateData(examId, q, order++) });
}

type DbQuestion = Prisma.ExamQuestionGetPayload<{ include: { options: true } }>;
/** Dạng trả cho GIA SƯ (có đáp án đúng, hướng dẫn chấm, tiêu chí). KHÔNG dùng cho học sinh. */
export function shapeQuestionForTutor(q: DbQuestion) {
  return {
    id: q.id, order: q.order, type: q.type, text: q.text, points: q.points, imageUrl: q.imageUrl, explanation: q.explanation, hint: q.hint,
    studentGuide: q.studentGuide, graderGuide: q.graderGuide, rubric: Array.isArray(q.rubric) ? q.rubric : null, sectionLabel: q.sectionLabel,
    options: [...q.options].sort((a, b) => a.order - b.order).map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
  };
}
export const toSnap = (q: DbQuestion): SnapQuestion => ({
  type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel, imageUrl: q.imageUrl, explanation: q.explanation, hint: q.hint,
  studentGuide: q.studentGuide, graderGuide: q.graderGuide, rubric: q.rubric,
  options: [...q.options].sort((a, b) => a.order - b.order).map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
});

export async function loadQuestions(examId: string): Promise<DbQuestion[]> {
  return prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
}

// ── Chuỗi phiên bản ───────────────────────────────────────────────────────────────────────────────
export async function loadChain(rootId: string) {
  return prisma.exam.findMany({
    where: { OR: [{ id: rootId }, { rootExamId: rootId }] },
    select: { id: true, code: true, title: true, versionNo: true, rootExamId: true, supersededById: true, supersededAt: true, isDraft: true, versionNote: true, date: true, time: true, duration: true, questions: true, createdAt: true, _count: { select: { attempts: true } } },
    orderBy: { versionNo: "asc" },
  });
}
export { rootIdOf };

/** Hết hạn mở bài chưa? Chỉ để hiện nhãn "Đã lên lịch / Đang mở / Đã đóng" — tính theo computeExamStatus, không đọc cột status đứng yên. */
export function statusOf(e: { date: string; time: string; active: boolean; isDraft: boolean }): "draft" | "upcoming" | "available" | "completed" {
  if (e.isDraft) return "draft";
  return computeExamStatus(e.date, e.time, e.active);
}
export { parseDurationMinutes };

/** Phần mô tả đề trả cho gia sư (không có mật khẩu — chỉ cờ hasPassword). */
export function shapeMeta(e: OwnedQuiz, attemptCount: number, courseName: string | null = null) {
  return {
    id: e.id, code: e.code, title: e.title, courseId: e.courseId, courseName,
    dateKey: keyFromDmy(e.date), time: e.time, durationMin: parseDurationMinutes(e.duration),
    isDraft: e.isDraft, active: e.active, status: statusOf(e),
    versionNo: e.versionNo, rootExamId: e.rootExamId, supersededById: e.supersededById, versionNote: e.versionNote,
    answerVisibility: e.answerVisibility, hideAnswerForWrong: e.hideAnswerForWrong, showLeaderboard: e.showLeaderboard,
    hasPassword: !!(e.passwordHash || e.password), totalPoints: e.totalPoints, questionCount: e.questions,
    attemptCount, canEditInPlace: canEditInPlace(attemptCount),
  };
}

/** Phiên bản cũ (đã bị bản mới thay) chỉ để xem: mọi thao tác ghi bị chặn. */
export function supersededBlock(e: { supersededById: string | null }): NextResponse | null {
  return e.supersededById
    ? NextResponse.json({ error: "Đây là phiên bản cũ, chỉ để xem. Mở phiên bản đang dùng để chỉnh.", code: "SUPERSEDED", supersededById: e.supersededById }, { status: 409 })
    : null;
}


/** Câu trong DB → dạng QuizQuestionInput để chạy lại cùng một bộ luật kiểm (dùng lúc phát hành). */
export function toInput(q: DbQuestion): QuizQuestionInput {
  return {
    type: q.type as QuizQuestionInput["type"], text: q.text, points: q.points, imageUrl: q.imageUrl, explanation: q.explanation, hint: q.hint,
    studentGuide: q.studentGuide, graderGuide: q.graderGuide, rubric: Array.isArray(q.rubric) ? (q.rubric as unknown as QuizQuestionInput["rubric"]) : null,
    sectionLabel: q.sectionLabel, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel })),
  };
}

/** Cho các API sửa câu hỏi CŨ (/api/exams/[id]/questions…): đề đã có lượt làm hoặc đã bị phiên bản mới thay thì không cho sửa đè. Trả null nếu được sửa. */
export async function blockOldEditIfLocked(examId: string): Promise<NextResponse | null> {
  const e = await prisma.exam.findUnique({ where: { id: examId }, select: { supersededById: true } });
  if (e?.supersededById) return supersededBlock(e);
  return blockIfHasAttempts(await countAttempts(examId));
}
