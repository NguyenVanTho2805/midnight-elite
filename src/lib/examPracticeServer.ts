// BU-04 — chấm từng câu LUYỆN TẬP (phần chạm DB). Luật thuần: examPracticeLib.ts (chính sách + dựng phản hồi), examCorrection.ts (máy trạng thái NV-188).
// Bất biến (có test API "t-exam-practice", "t-exam-attack"):
//  • Chỉ chủ lượt; lượt phải đang làm; đề phải là mode=practice và KHÔNG giữ điểm; câu phải thuộc đề của lượt; không chấm tự luận.
//  • Đáp án được chấm là đáp án ĐÃ LƯU ở máy chủ — không lấy từ thân yêu cầu.
//  • Đáp án / lời giải chỉ có trong phản hồi theo practicePolicy; ở trạng thái "hint" không bao giờ có.
//  • Không ghi ExamAttempt.score / ExamAnswer: điểm vẫn chấm lúc nộp theo đáp án cuối (computeRawEarned).
import { prisma } from "@/lib/prisma";
import { attemptWriteBlock } from "@/lib/attemptAccess";
import { examHolds } from "@/lib/examHold";
import { finalizeAttempt, hasExamWindowEnded } from "@/lib/examGrading";
import {
  EMPTY_CORRECTION, afterReveal, afterSubmit, canReveal, isFinished, multiAnswerCorrect, shortAnswerCorrect, type CorrectionRow,
} from "@/lib/examCorrection";
import { buildPracticeResponse, clusterRightCount, practicePolicy } from "@/lib/examPracticeLib";
import type { PracticeCheckResponse } from "@/lib/examRoomApi";

export type PracticeFail = { ok: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): PracticeFail => ({ ok: false, status, code, error });

export async function checkPracticeQuestion(
  userId: string, attemptId: string, body: { questionId?: unknown; action?: unknown },
): Promise<{ ok: true; data: PracticeCheckResponse } | PracticeFail> {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  // 404 (không phải 403) để không lộ lượt thi của người khác có tồn tại hay không.
  if (!attempt || attempt.userId !== userId) return fail(404, "not_found", "Không tìm thấy bài thi");
  // Đã nghỉ lớp giữa chừng thì không nhận phản hồi đúng/sai (cùng luật với submit/answer).
  const suspended = await attemptWriteBlock(userId, attempt.examId);
  if (suspended) return fail(403, suspended.code, suspended.error);
  if (attempt.status !== "in_progress") return fail(409, "finished", "Bài thi đã kết thúc");
  if (attempt.expiresAt.getTime() <= Date.now()) {
    await finalizeAttempt(attempt.id, { status: "expired", at: attempt.expiresAt });
    return fail(409, "expired", "Đã hết giờ làm bài");
  }

  const exam = await prisma.exam.findUnique({ where: { id: attempt.examId }, select: { id: true, mode: true, answerVisibility: true, hideAnswerForWrong: true, date: true, time: true, duration: true } });
  if (!exam) return fail(404, "not_found", "Không tìm thấy đề thi");
  if (exam.mode !== "practice") return fail(403, "not_practice", "Đề này là bài kiểm tra, không có chấm từng câu.");
  const policy = practicePolicy(exam, await examHolds(prisma, exam.id), hasExamWindowEnded(exam));
  if (policy.feedback === "none") return fail(403, "no_feedback", "Đề này có phần gia sư chấm, chưa có phản hồi từng câu.");

  const action = body.action === undefined ? "check" : body.action;
  if (action !== "check" && action !== "reveal") return fail(400, "bad_action", "action không hợp lệ");
  if (typeof body.questionId !== "string" || !body.questionId) return fail(400, "bad_question", "Thiếu questionId");

  const q = await prisma.examQuestion.findFirst({ where: { id: body.questionId, examId: attempt.examId }, include: { options: { orderBy: { order: "asc" } } } });
  if (!q) return fail(404, "not_found", "Không tìm thấy câu hỏi trong đề này");
  if (q.type === "ESSAY") return fail(400, "not_checkable", "Câu tự luận do gia sư chấm, không có phản hồi từng câu.");
  if (!["MC", "MC_MULTI", "SHORT_ANSWER", "TRUE_FALSE_CLUSTER"].includes(q.type)) return fail(400, "not_checkable", "Dạng câu này chưa có phản hồi từng câu.");

  const truths = q.options.map(o => ({ optionId: o.id, isTrue: o.isCorrect }));
  const correctOpt = q.options.find(o => o.isCorrect);
  const hasHint = !!q.hint?.trim();

  // Đáp án ĐÃ LƯU của học sinh (không lấy từ yêu cầu).
  let correct = false, rightCount: number | undefined, lastOptionId: string | null = null, lastOptionIds: string[] = [], lastText: string | null = null;
  if (action === "check") {
    if (q.type === "MC") {
      const a = await prisma.examAnswer.findUnique({ where: { attemptId_questionId: { attemptId, questionId: q.id } } });
      if (!a?.optionId) return fail(409, "not_answered", "Em chọn đáp án trước đã nhé.");
      lastOptionId = a.optionId;
      correct = a.optionId === correctOpt?.id;
    } else if (q.type === "SHORT_ANSWER") {
      const a = await prisma.examAnswer.findUnique({ where: { attemptId_questionId: { attemptId, questionId: q.id } } });
      if (!a?.textAnswer?.trim()) return fail(409, "not_answered", "Em nhập đáp án trước đã nhé.");
      lastText = a.textAnswer.trim();
      correct = shortAnswerCorrect(a.textAnswer, correctOpt?.text);
    } else {
      const rows = await prisma.examAnswerBoolean.findMany({ where: { attemptId, optionId: { in: q.options.map(o => o.id) } } });
      const given: Record<string, boolean | null> = {};
      for (const r of rows) given[r.optionId] = r.answerTrue;
      if (q.type === "MC_MULTI") {
        const picked = q.options.filter(o => given[o.id] === true).map(o => o.id);
        if (picked.length === 0) return fail(409, "not_answered", "Em chọn đáp án trước đã nhé.");
        lastOptionIds = picked;
        correct = multiAnswerCorrect(q.options.filter(o => o.isCorrect).map(o => o.id), picked);
      } else {
        if (q.options.length === 0 || !q.options.every(o => given[o.id] === true || given[o.id] === false)) return fail(409, "not_answered", "Em trả lời đủ các ý trước đã nhé.");
        rightCount = clusterRightCount(truths, given);
        correct = rightCount === q.options.length;
      }
    }
  }

  // Mọi thao tác trên một (lượt × câu) khoá bằng advisory lock: hai lần bấm cùng lúc không đếm đôi lượt thử.
  const out = await prisma.$transaction(async (tx): Promise<{ ok: true; row: CorrectionRow } | PracticeFail> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`correction:${attemptId}:${q.id}`}))`;
    const cur = await tx.examCorrection.findUnique({ where: { attemptId_questionId: { attemptId, questionId: q.id } } });
    const c: CorrectionRow = cur ? { tries: cur.tries, solved: cur.solved, revealed: cur.revealed } : EMPTY_CORRECTION;
    if (isFinished(c)) return fail(409, "already_done", "Câu này đã xong rồi.");
    let next: CorrectionRow;
    const data: { lastOptionId?: string | null; lastOptionIds?: string[]; lastText?: string | null } = {};
    if (action === "check") {
      next = afterSubmit(c, correct, hasHint);
      data.lastOptionId = lastOptionId; data.lastOptionIds = lastOptionIds; data.lastText = lastText;
    } else {
      if (!canReveal(c)) return fail(409, "reveal_too_early", "Em cần kiểm tra câu này ít nhất một lần trước khi xem đáp án.");
      next = afterReveal(c);
    }
    const saved = await tx.examCorrection.upsert({
      where: { attemptId_questionId: { attemptId, questionId: q.id } },
      create: { attemptId, questionId: q.id, tries: next.tries, solved: next.solved, revealed: next.revealed, ...data },
      update: { tries: next.tries, solved: next.solved, revealed: next.revealed, ...data },
    });
    return { ok: true, row: { tries: saved.tries, solved: saved.solved, revealed: saved.revealed } };
  });
  if (!out.ok) return out;

  return {
    ok: true,
    data: buildPracticeResponse({
      questionId: q.id, type: q.type, correct, row: out.row, hint: q.hint,
      correctOptionIds: q.type === "MC" ? (correctOpt ? [correctOpt.id] : []) : q.type === "MC_MULTI" ? q.options.filter(o => o.isCorrect).map(o => o.id) : [],
      correctText: q.type === "SHORT_ANSWER" ? correctOpt?.text ?? null : null,
      clusterTruths: q.type === "TRUE_FALSE_CLUSTER" ? truths : [],
      explanation: q.explanation, rightCount,
    }, policy),
  };
}
