// NV-188 — Chữa bài: gợi ý trước, đáp án sau, nhưng có điểm dừng. THUẦN (không Prisma) để test.
// Đặc tả: docs/kin/nghiep-vu/hoc-tu-khan.md mục NV-188.
//
//   Chưa nộp                → câu hỏi + lựa chọn, chưa có gợi ý, chưa có đáp án       [Nộp câu này]
//   Nộp lần 1, sai          → "Chưa đúng" + MỘT gợi ý, chưa có đáp án                [Thử lại] [Xem đáp án]
//   Nộp lần 2 vẫn sai, hoặc bấm "Xem đáp án" → đáp án + lời giải                      [Sang câu tiếp]
//   Đúng ngay lần 1 (hoặc lần 2) → hiện luôn lời giải, không hiện gợi ý (lần 1)
//   Câu CHƯA có gợi ý: bỏ bước 2 — sai lần 1 là hiện đáp án luôn.
// Điểm dừng là HAI lần nộp: KiN không bao giờ giữ đáp án mãi (Khanmigo làm vậy nên học sinh bỏ dùng).
// Chữa bài chỉ để HỌC — không bao giờ đổi điểm bài thi (điểm tính theo lần nộp đầu, lúc nộp bài).

export const MAX_TRIES = 2;
export const CORRECTABLE_TYPES = ["MC", "MC_MULTI", "SHORT_ANSWER"] as const;
export type CorrectableType = (typeof CORRECTABLE_TYPES)[number];
export const isCorrectableType = (t: string): t is CorrectableType => (CORRECTABLE_TYPES as readonly string[]).includes(t);

export interface CorrectionRow { tries: number; solved: boolean; revealed: boolean }
export type CorrectionState = "new" | "hint" | "solved" | "revealed";

export const EMPTY_CORRECTION: CorrectionRow = { tries: 0, solved: false, revealed: false };

export function correctionState(c: CorrectionRow): CorrectionState {
  if (c.solved) return "solved";
  if (c.revealed) return "revealed";
  return c.tries >= 1 ? "hint" : "new";
}

/** Đã xong (đúng, hoặc đã xem đáp án) → không nộp thêm được nữa. */
export const isFinished = (c: CorrectionRow) => c.solved || c.revealed;

/** "Xem đáp án" chỉ có sau khi đã nộp ít nhất một lần và chưa xong. */
export const canReveal = (c: CorrectionRow) => !isFinished(c) && c.tries >= 1;

/** Một lần nộp: tăng số lần, rồi xét đúng/sai và điểm dừng. */
export function afterSubmit(c: CorrectionRow, correct: boolean, hasHint: boolean): CorrectionRow {
  const tries = c.tries + 1;
  if (correct) return { tries, solved: true, revealed: false };
  // Sai: hết lượt, hoặc câu không có gợi ý để hiện ở bước 2 → cho xem đáp án luôn.
  const stop = tries >= MAX_TRIES || !hasHint;
  return { tries, solved: false, revealed: stop };
}

export function afterReveal(c: CorrectionRow): CorrectionRow {
  return { ...c, revealed: true };
}

/** Gợi ý chỉ lộ ra khi đang ở bước 2 (đã nộp sai một lần, chưa xong) và câu có gợi ý. */
export const hintVisible = (c: CorrectionRow, hint: string | null | undefined) =>
  correctionState(c) === "hint" && !!hint?.trim();

/** Gợi ý đã từng hiện cho học sinh: có nộp sai lần 1 rồi mới tới trạng thái xong (đúng ngay lần 1 thì chưa từng thấy gợi ý). */
export const hintWasShown = (c: CorrectionRow, hadHint: boolean) =>
  hadHint && (c.tries >= 2 || (c.tries === 1 && c.revealed && !c.solved));

/** Ô "tự giải thích" chỉ hợp lý khi học sinh THỰC SỰ đã được xem gợi ý và đã xong câu. */
export const reflectionAllowed = (c: CorrectionRow, hadHint: boolean) => isFinished(c) && hintWasShown(c, hadHint);

/**
 * Câu NHIỀU ĐÁP ÁN (QZ-03): đúng khi chọn ĐỦ mọi ô đúng và KHÔNG chọn ô sai nào — cùng luật với scoreMultiSelect lúc chấm bài thi.
 * `correctIds` rỗng (câu hỏng) → luôn sai, không bao giờ "đúng vì không chọn gì". Id lặp được gộp lại.
 */
export function multiAnswerCorrect(correctIds: readonly string[], selectedIds: readonly string[]): boolean {
  if (correctIds.length === 0) return false;
  const correct = new Set(correctIds), chosen = new Set(selectedIds);
  if (chosen.size !== correct.size) return false;
  for (const id of chosen) if (!correct.has(id)) return false;
  return true;
}

/** Đọc danh sách ô đã chọn từ thân yêu cầu: phải là mảng id chuỗi, mỗi id thuộc `validIds`, ít nhất 1 ô; lặp id được gộp. Sai → null. */
export function normalizePickedIds(raw: unknown, validIds: readonly string[]): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > validIds.length * 2) return null;
  if (raw.some(x => typeof x !== "string")) return null;
  const valid = new Set(validIds);
  const out = [...new Set(raw as string[])];
  return out.every(id => valid.has(id)) ? out : null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");

/** Câu điền ngắn: so khớp như lúc chấm bài thi (không phân biệt hoa thường, dấu phẩy = dấu chấm). */
export function shortAnswerCorrect(studentText: string | null | undefined, correctText: string | null | undefined): boolean {
  if (!studentText?.trim() || !correctText?.trim()) return false;
  return norm(studentText) === norm(correctText);
}

export const REFLECTION_MAX = 500;
export const SHORT_ANSWER_MAX = 200;

export const HINT_MAX = 1000;

/** Gợi ý do gia sư soạn: trống → null (bỏ bước gợi ý); quá dài → từ chối. */
export function normalizeHint(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const v = raw.trim();
  if (v.length > HINT_MAX) return { ok: false };
  return { ok: true, value: v || null };
}
