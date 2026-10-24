// NV-188 — Chữa bài (phần chạm DB). Quy tắc thuần ở examCorrection.ts.
//
// Bất biến an toàn (có test):
//  • Chỉ chủ lượt thi, chỉ lượt đã nộp, chỉ khi đề cho xem đáp án và KHÔNG bật hideAnswerForWrong.
//  • Chỉ câu MC / điền ngắn mà học sinh đã làm SAI hoặc bỏ trống trong bài thi.
//  • Đáp án và lời giải CHỈ có trong phản hồi khi câu đã xong (đúng hoặc đã xem đáp án); gợi ý CHỈ lộ ở bước 2.
//  • Không bao giờ ghi vào ExamAttempt.score / ExamAnswer: chữa bài chỉ để học.
//  • Mọi thao tác trên một (lượt × câu) khoá bằng advisory lock; hai lần bấm cùng lúc không đếm đôi lượt nộp.
import { prisma } from "@/lib/prisma";
import { isAttemptHeld } from "@/lib/examHold";
import { hasExamWindowEnded, loadAnswerState, orderQuestionsAndOptionsFull } from "@/lib/examGrading";
import {
  EMPTY_CORRECTION, REFLECTION_MAX, SHORT_ANSWER_MAX, afterReveal, afterSubmit, canReveal, correctionState, hintVisible,
  isCorrectableType, isFinished, reflectionAllowed, shortAnswerCorrect, type CorrectionRow, type CorrectionState,
} from "@/lib/examCorrection";

export interface CorrectionItem {
  questionId: string;
  index: number; // thứ tự câu trong bài thi (1-based)
  type: "MC" | "SHORT_ANSWER";
  text: string;
  imageUrl: string | null;
  points: number;
  sectionLabel: string | null;
  options: { id: string; text: string }[]; // MC; câu điền ngắn: rỗng (đáp án đúng nằm trong ExamOption nên không được lộ)
  state: CorrectionState;
  tries: number;
  yourOptionId: string | null; // lần nộp gần nhất (MC)
  yourText: string | null;     // lần nộp gần nhất (điền ngắn)
  lastTryCorrect: boolean | null;
  hint: string | null;          // chỉ ở bước 2
  canReveal: boolean;
  /** Chỉ có khi câu đã xong. */
  answer: { correctOptionId: string | null; correctText: string | null; explanation: string | null } | null;
  reflection: string | null;
  canReflect: boolean;
}

export interface CorrectionOverview {
  available: boolean;
  reason: string | null;
  items: CorrectionItem[];
  summary: { total: number; solved: number; revealed: number; remaining: number };
}

type Failure = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Failure => ({ ok: false, status, error });

type Row = CorrectionRow & { lastOptionId: string | null; lastText: string | null; reflection: string | null };

interface Ctx {
  attemptId: string;
  available: boolean;
  reason: string | null;
  /** Chỉ các câu chữa được (làm sai/bỏ trống), theo thứ tự trong bài thi. */
  questions: { q: Awaited<ReturnType<typeof loadOrdered>>[number]; index: number }[];
  rows: Map<string, Row>;
}

async function loadOrdered(examId: string, attempt: { questionOrder: unknown; optionOrderByQuestion: unknown }) {
  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } },
  });
  return orderQuestionsAndOptionsFull(examQuestions, attempt);
}

/** Cho review: đề cho phép chữa bài không (không phụ thuộc bài làm). */
export function correctionAllowedByExam(exam: { answerVisibility: string; hideAnswerForWrong: boolean; date: string; time: string; duration: string }): boolean {
  const canSee = exam.answerVisibility === "after_submit" ? true : exam.answerVisibility === "after_exam_ends" ? hasExamWindowEnded(exam) : false;
  return canSee && !exam.hideAnswerForWrong;
}

/** Học sinh làm sai/bỏ trống câu này trong bài thi? Chỉ xét MC và điền ngắn. */
export function wasWrongInExam(
  q: { id: string; type: string; options: { id: string; text: string; isCorrect: boolean }[] },
  answers: Record<string, string | null>, textAnswers: Record<string, string>,
): boolean {
  if (q.type === "MC") {
    const chosen = q.options.find(o => o.id === answers[q.id]);
    return !chosen?.isCorrect;
  }
  if (q.type === "SHORT_ANSWER") return !shortAnswerCorrect(textAnswers[q.id], q.options.find(o => o.isCorrect)?.text);
  return false;
}

async function loadContext(userId: string, attemptId: string): Promise<{ ok: true; ctx: Ctx } | Failure> {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  // 404 (không phải 403) để không lộ lượt thi của người khác có tồn tại hay không
  if (!attempt || attempt.userId !== userId) return fail(404, "Không tìm thấy bài thi");
  if (attempt.status === "in_progress") return fail(409, "Bài thi chưa nộp");
  const exam = await prisma.exam.findUnique({ where: { id: attempt.examId } });
  if (!exam) return fail(404, "Không tìm thấy đề thi");

  // QZ-08: chưa công bố thì chưa chữa bài (chữa bài lộ đáp án câu sai).
  if (await isAttemptHeld(prisma, attempt)) {
    return { ok: true, ctx: { attemptId, available: false, reason: "Cô chưa công bố điểm bài này nên chưa chữa bài được.", questions: [], rows: new Map() } };
  }
  if (!correctionAllowedByExam(exam)) {
    return { ok: true, ctx: { attemptId, available: false, reason: "Đề này chưa cho xem đáp án nên chưa có chế độ chữa bài.", questions: [], rows: new Map() } };
  }
  const [ordered, state, rows] = await Promise.all([
    loadOrdered(exam.id, attempt),
    loadAnswerState(attemptId),
    prisma.examCorrection.findMany({ where: { attemptId } }),
  ]);
  const questions = ordered
    .map((q, i) => ({ q, index: i + 1 }))
    .filter(({ q }) => isCorrectableType(q.type) && wasWrongInExam(q, state.answers, state.textAnswers));
  return {
    ok: true,
    ctx: {
      attemptId, available: true, reason: null, questions,
      rows: new Map(rows.map(r => [r.questionId, { tries: r.tries, solved: r.solved, revealed: r.revealed, lastOptionId: r.lastOptionId, lastText: r.lastText, reflection: r.reflection }])),
    },
  };
}

function toItem(entry: Ctx["questions"][number], row: Row | undefined): CorrectionItem {
  const { q, index } = entry;
  const c: CorrectionRow = row ?? EMPTY_CORRECTION;
  const hasHint = !!q.hint?.trim();
  const finished = isFinished(c);
  const correctOpt = q.options.find(o => o.isCorrect);
  const state = correctionState(c);
  return {
    questionId: q.id, index, type: q.type as "MC" | "SHORT_ANSWER",
    text: q.text, imageUrl: q.imageUrl, points: q.points, sectionLabel: q.sectionLabel,
    options: q.type === "MC" ? q.options.map(o => ({ id: o.id, text: o.text })) : [],
    state, tries: c.tries,
    yourOptionId: row?.lastOptionId ?? null, yourText: row?.lastText ?? null,
    lastTryCorrect: c.solved ? true : c.tries >= 1 ? false : null,
    hint: hintVisible(c, q.hint) ? q.hint!.trim() : null,
    canReveal: canReveal(c),
    answer: finished
      ? { correctOptionId: q.type === "MC" ? correctOpt?.id ?? null : null, correctText: q.type === "SHORT_ANSWER" ? correctOpt?.text ?? null : null, explanation: q.explanation }
      : null,
    reflection: row?.reflection ?? null,
    canReflect: reflectionAllowed(c, hasHint),
  };
}

function overview(ctx: Ctx): CorrectionOverview {
  const items = ctx.questions.map(e => toItem(e, ctx.rows.get(e.q.id)));
  const solved = items.filter(i => i.state === "solved").length;
  const revealed = items.filter(i => i.state === "revealed").length;
  return { available: ctx.available, reason: ctx.reason, items, summary: { total: items.length, solved, revealed, remaining: items.length - solved - revealed } };
}

export async function getCorrection(userId: string, attemptId: string): Promise<{ ok: true; data: CorrectionOverview } | Failure> {
  const r = await loadContext(userId, attemptId);
  return r.ok ? { ok: true, data: overview(r.ctx) } : r;
}

/**
 * Cho màn "Xem lại bài làm": số câu chữa được và các câu CHƯA chữa xong. Đặc tả NV-188: màn chữa bài không hiện đáp án
 * cho tới khi học sinh đã thử một lần — nên với các câu này /review phải giấu đáp án và lời giải (nếu không, học sinh
 * chỉ cần mở màn xem lại là thấy đáp án, bỏ qua bước gợi ý). Câu đã xong (đúng / đã xem đáp án) thì hiện bình thường.
 */
export async function correctionSummary(userId: string, attemptId: string): Promise<{ correctableCount: number; pendingIds: Set<string> }> {
  const r = await loadContext(userId, attemptId);
  if (!r.ok || !r.ctx.available) return { correctableCount: 0, pendingIds: new Set() };
  const pending = r.ctx.questions.filter(e => !isFinished(r.ctx.rows.get(e.q.id) ?? EMPTY_CORRECTION)).map(e => e.q.id);
  return { correctableCount: r.ctx.questions.length, pendingIds: new Set(pending) };
}

export type CorrectionAction =
  | { action: "submit"; optionId?: unknown; text?: unknown }
  | { action: "reveal" }
  | { action: "reflect"; text?: unknown };

export async function actOnCorrection(userId: string, attemptId: string, questionId: string, body: CorrectionAction): Promise<{ ok: true; item: CorrectionItem; summary: CorrectionOverview["summary"] } | Failure> {
  const loaded = await loadContext(userId, attemptId);
  if (!loaded.ok) return loaded;
  const { ctx } = loaded;
  if (!ctx.available) return fail(403, ctx.reason ?? "Chưa có chế độ chữa bài");
  const entry = ctx.questions.find(e => e.q.id === questionId);
  if (!entry) return fail(404, "Câu này không cần chữa (bạn đã làm đúng) hoặc không thuộc bài thi");
  const q = entry.q;
  const hasHint = !!q.hint?.trim();
  const correctOpt = q.options.find(o => o.isCorrect);

  // Kiểm tra đầu vào trước khi vào transaction.
  let optionId: string | null = null, text: string | null = null, correct = false;
  if (body.action === "submit") {
    if (q.type === "MC") {
      if (typeof body.optionId !== "string" || !q.options.some(o => o.id === body.optionId)) return fail(400, "Lựa chọn không hợp lệ");
      optionId = body.optionId;
      correct = optionId === correctOpt?.id;
    } else {
      if (typeof body.text !== "string" || !body.text.trim()) return fail(400, "Hãy nhập câu trả lời");
      if (body.text.length > SHORT_ANSWER_MAX) return fail(400, `Câu trả lời tối đa ${SHORT_ANSWER_MAX} ký tự`);
      text = body.text.trim();
      correct = shortAnswerCorrect(text, correctOpt?.text);
    }
  } else if (body.action === "reflect") {
    if (typeof body.text !== "string" || !body.text.trim()) return fail(400, "Hãy viết một câu");
    if (body.text.length > REFLECTION_MAX) return fail(400, `Tối đa ${REFLECTION_MAX} ký tự`);
    text = body.text.trim();
  } else if (body.action !== "reveal") {
    return fail(400, "action không hợp lệ");
  }

  const result = await prisma.$transaction(async (tx): Promise<{ ok: true; row: Row } | Failure> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`correction:${attemptId}:${questionId}`}))`;
    const cur = await tx.examCorrection.findUnique({ where: { attemptId_questionId: { attemptId, questionId } } });
    const c: CorrectionRow = cur ? { tries: cur.tries, solved: cur.solved, revealed: cur.revealed } : EMPTY_CORRECTION;
    let next: CorrectionRow = c;
    const data: { lastOptionId?: string | null; lastText?: string | null; reflection?: string | null } = {};

    if (body.action === "submit") {
      if (isFinished(c)) return fail(409, "Câu này đã xong, bạn không cần nộp thêm");
      next = afterSubmit(c, correct, hasHint);
      data.lastOptionId = optionId; data.lastText = text;
    } else if (body.action === "reveal") {
      if (!canReveal(c)) return fail(409, "Bạn cần nộp câu này ít nhất một lần trước khi xem đáp án");
      next = afterReveal(c);
    } else {
      if (!reflectionAllowed(c, hasHint)) return fail(409, "Chỉ viết được sau khi đã xem gợi ý và xong câu này");
      data.reflection = text;
    }
    const saved = await tx.examCorrection.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, tries: next.tries, solved: next.solved, revealed: next.revealed, ...data },
      update: { tries: next.tries, solved: next.solved, revealed: next.revealed, ...data },
    });
    return { ok: true, row: { tries: saved.tries, solved: saved.solved, revealed: saved.revealed, lastOptionId: saved.lastOptionId, lastText: saved.lastText, reflection: saved.reflection } };
  });
  if (!result.ok) return result;

  ctx.rows.set(questionId, result.row);
  return { ok: true, item: toItem(entry, result.row), summary: overview(ctx).summary };
}
