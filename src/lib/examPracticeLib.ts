// BU-04 — chấm từng câu ở chế độ LUYỆN TẬP. THUẦN (không prisma, không next). Phần có DB: examPracticeServer.ts.
// Luật máy trạng thái (2 lần thử, gợi ý, xem đáp án) là NV-188 trong examCorrection.ts — KHÔNG viết lại ở đây, chỉ gọi.
// Bất biến an toàn (có test "ca phá"): ở trạng thái `hint` phản hồi KHÔNG có đáp án, lời giải, id đáp án đúng, sự thật từng ý;
// Đúng–Sai chỉ nói "đúng k/4 ý", không nói ý nào. Phản hồi dựng theo danh sách trắng, không spread dữ liệu câu hỏi.
import {
  canReveal, correctionState, hintVisible, type CorrectionRow,
} from "@/lib/examCorrection";
import type { PracticeAnswerReveal, PracticeCheckResponse, PracticeFeedbackMode } from "@/lib/examRoomApi";

export interface PracticePolicy {
  feedback: PracticeFeedbackMode;
  /** Đề cho xem đáp án (answerVisibility khác "never"). */
  revealAllowed: boolean;
  /** Lời giải đi cùng đáp án. */
  explainAllowed: boolean;
  /** hideAnswerForWrong: chỉ lộ đáp án khi học sinh TỰ làm đúng (state "solved"). */
  hideWrong: boolean;
}

/**
 * Chính sách chấm từng câu. `held` = đề đang giữ điểm tới khi gia sư công bố (examHold) ⇒ không phản hồi từng câu.
 * Chỉ `mode === "practice"` mới có phản hồi tức thì; kiểm tra (test) và đề cũ (mode null) thì không.
 */
export function practicePolicy(exam: { mode: string | null; answerVisibility: string; hideAnswerForWrong: boolean }, held: boolean): PracticePolicy {
  const reveal = exam.answerVisibility !== "never";
  return {
    feedback: exam.mode === "practice" && !held ? "instant" : "none",
    revealAllowed: reveal,
    explainAllowed: reveal,
    hideWrong: exam.hideAnswerForWrong === true,
  };
}

/** Số ý Đúng–Sai mà đáp án ĐÃ LƯU của học sinh khớp sự thật. Ý chưa trả lời (thiếu / null) không tính. */
export function clusterRightCount(truths: readonly { optionId: string; isTrue: boolean }[], given: Readonly<Record<string, boolean | null | undefined>>): number {
  let n = 0;
  for (const t of truths) if (given[t.optionId] === t.isTrue) n++;
  return n;
}

export interface PracticeInput {
  questionId: string;
  type: string;
  /** Kết quả lần chấm VỪA RỒI. */
  correct: boolean;
  /** Dòng ExamCorrection SAU lần chấm (tries ≥ 1). */
  row: CorrectionRow;
  /** Gợi ý do gia sư soạn (chưa lọc). */
  hint: string | null | undefined;
  /** Dữ liệu đáp án — CHỈ được đưa ra khi chính sách cho phép. */
  correctOptionIds: readonly string[];
  correctText: string | null;
  clusterTruths: readonly { optionId: string; isTrue: boolean }[];
  explanation: string | null | undefined;
  /** Chỉ câu Đúng–Sai. */
  rightCount?: number;
}

export function buildPracticeResponse(inp: PracticeInput, policy: PracticePolicy): PracticeCheckResponse {
  const state = correctionState(inp.row);
  // "new" chỉ xảy ra khi người gọi chưa chấm lần nào — chặn ở máy chủ trước đó; ở đây coi như hint rỗng để KHÔNG lộ gì.
  const done = state === "solved" || state === "revealed";
  const allowed = done && policy.revealAllowed && (!policy.hideWrong || state === "solved");
  const blocked: PracticeCheckResponse["revealBlockedReason"] =
    !done || allowed ? null : !policy.revealAllowed ? "never" : "hide_wrong";

  const answer: PracticeAnswerReveal | null = allowed
    ? { correctOptionIds: [...inp.correctOptionIds], correctText: inp.correctText, clusterTruths: inp.clusterTruths.map(t => ({ optionId: t.optionId, isTrue: t.isTrue })) }
    : null;

  const res: PracticeCheckResponse = {
    questionId: inp.questionId,
    state: state === "new" ? "hint" : state,
    correct: inp.correct,
    tries: inp.row.tries,
    hint: hintVisible(inp.row, inp.hint) ? (inp.hint as string).trim() : null,
    canReveal: canReveal(inp.row),
    answer,
    explanation: allowed && policy.explainAllowed ? (inp.explanation?.trim() ? inp.explanation : null) : null,
    revealBlockedReason: blocked,
  };
  if (inp.type === "TRUE_FALSE_CLUSTER" && typeof inp.rightCount === "number") res.rightCount = inp.rightCount;
  return res;
}
