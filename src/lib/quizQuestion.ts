// QZ-03 — soạn câu hỏi cho gia sư (Figma 521:4667): luật THUẦN dùng chung cho trình soạn (trình duyệt) và các API (máy chủ). Không DB, không React.
// Hai dạng mới so với bài tập web cũ: "MC_MULTI" (nhiều đáp án đúng, chấm đủ-hoặc-không) và "ESSAY" có tiêu chí chấm (rubric) + hướng dẫn.
// Các dạng cũ (MC, TRUE_FALSE_CLUSTER, SHORT_ANSWER) giữ đúng luật của validateQuestionOptions để đề cũ và trang /admin/thi-thu không đổi.
import { validateQuestionOptions } from "@/lib/examQuestionParser";

export type QuizQuestionType = "MC" | "MC_MULTI" | "ESSAY" | "TRUE_FALSE_CLUSTER" | "SHORT_ANSWER";
export const QUIZ_QUESTION_TYPES: readonly QuizQuestionType[] = ["MC", "MC_MULTI", "ESSAY", "TRUE_FALSE_CLUSTER", "SHORT_ANSWER"];
export const QUIZ_TYPE_LABEL: Record<QuizQuestionType, string> = {
  MC: "Một đáp án", MC_MULTI: "Nhiều đáp án", ESSAY: "Tự luận", TRUE_FALSE_CLUSTER: "Đúng-Sai 4 ý", SHORT_ANSWER: "Trả lời ngắn",
};

export interface RubricRow { name: string; requirement: string; points: number }
export interface QuizOptionInput { text: string; isCorrect: boolean; subLabel?: string | null }
export interface QuizQuestionInput {
  type: QuizQuestionType;
  text: string;
  points: number;
  imageUrl?: string | null;
  explanation?: string | null;
  hint?: string | null;
  studentGuide?: string | null;
  graderGuide?: string | null;
  rubric?: RubricRow[] | null;
  sectionLabel?: string | null;
  options: QuizOptionInput[];
}

export const LIMITS = { text: 10_000, option: 2_000, note: 3_000, rubricRows: 10, rubricName: 100, rubricReq: 300, points: 1_000, maxOptions: 10 } as const;

/** Làm tròn 2 chữ số thập phân: tránh 0,1+0,2≠0,3 làm tổng tiêu chí lệch vì sai số số thực. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function isQuizType(v: unknown): v is QuizQuestionType {
  return typeof v === "string" && (QUIZ_QUESTION_TYPES as readonly string[]).includes(v);
}

/**
 * Chấm câu NHIỀU ĐÁP ÁN: đủ HẾT đáp án đúng VÀ không chọn ô sai nào → nhận đủ điểm; ngoài ra 0. Không chấm từng phần, không trừ điểm âm.
 * `correctIds` rỗng (câu hỏng) → 0 điểm, không bao giờ "đúng vì không chọn gì". Id lạ / lặp trong `selectedIds` được tính là chọn sai / gộp lại.
 */
export function scoreMultiSelect(correctIds: readonly string[], selectedIds: readonly string[], points: number): number {
  if (!(points > 0) || correctIds.length === 0) return 0;
  const correct = new Set(correctIds);
  const chosen = new Set(selectedIds);
  if (chosen.size !== correct.size) return 0;
  for (const id of chosen) if (!correct.has(id)) return 0;
  return points;
}

export function rubricTotal(rows: readonly RubricRow[]): number {
  return round2(rows.reduce((s, r) => s + r.points, 0));
}

/** Đọc rubric từ dữ liệu không tin cậy (JSON cột DB hoặc thân yêu cầu). Rỗng/null → { ok: true, rows: [] } (câu không có tiêu chí). */
export function normalizeRubric(raw: unknown): { ok: true; rows: RubricRow[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, rows: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Tiêu chí chấm phải là một danh sách" };
  if (raw.length > LIMITS.rubricRows) return { ok: false, error: `Tối đa ${LIMITS.rubricRows} tiêu chí chấm` };
  const rows: RubricRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown> | null;
    if (!r || typeof r !== "object") return { ok: false, error: `Tiêu chí ${i + 1} không đọc được` };
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const requirement = typeof r.requirement === "string" ? r.requirement.trim() : "";
    const pts = typeof r.points === "number" ? r.points : Number(String(r.points ?? "").replace(",", "."));
    if (!name) return { ok: false, error: `Tiêu chí ${i + 1} chưa có tên` };
    if (name.length > LIMITS.rubricName) return { ok: false, error: `Tên tiêu chí ${i + 1} quá dài (tối đa ${LIMITS.rubricName} ký tự)` };
    if (requirement.length > LIMITS.rubricReq) return { ok: false, error: `Yêu cầu của tiêu chí ${i + 1} quá dài (tối đa ${LIMITS.rubricReq} ký tự)` };
    if (!Number.isFinite(pts) || pts <= 0 || pts > LIMITS.points) return { ok: false, error: `Điểm của tiêu chí ${i + 1} phải là số lớn hơn 0` };
    rows.push({ name, requirement, points: round2(pts) });
  }
  return { ok: true, rows };
}

function fmt(n: number): string { return String(round2(n)).replace(".", ","); }

/** Kiểm một câu. Trả chuỗi lỗi đầu tiên (tiếng Việt, nói rõ sửa gì) hoặc null nếu hợp lệ. Luật chạy ở MÁY CHỦ — trình soạn chỉ dùng lại để báo sớm. */
export function validateQuizQuestion(q: QuizQuestionInput): string | null {
  if (!isQuizType(q.type)) return "Loại câu hỏi không hợp lệ";
  if (typeof q.text !== "string" || !q.text.trim()) return "Thiếu nội dung câu hỏi";
  if (q.text.length > LIMITS.text) return `Nội dung câu hỏi quá dài (tối đa ${LIMITS.text} ký tự)`;
  if (typeof q.points !== "number" || !Number.isFinite(q.points) || q.points <= 0 || q.points > LIMITS.points) return "Điểm của câu phải là số lớn hơn 0";
  for (const [label, v] of [["Giải thích", q.explanation], ["Hướng dẫn cho học sinh", q.studentGuide], ["Hướng dẫn chấm", q.graderGuide], ["Gợi ý", q.hint]] as const) {
    if (v != null && (typeof v !== "string" || v.length > LIMITS.note)) return `${label} quá dài (tối đa ${LIMITS.note} ký tự)`;
  }
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length > LIMITS.maxOptions) return `Tối đa ${LIMITS.maxOptions} lựa chọn`;
  if (options.some(o => typeof o?.text !== "string" || o.text.length > LIMITS.option)) return `Mỗi lựa chọn tối đa ${LIMITS.option} ký tự`;

  if (q.type === "MC_MULTI") {
    if (options.length < 2) return "Cần ít nhất 2 lựa chọn";
    if (options.some(o => !o.text.trim())) return "Có lựa chọn còn trống";
    if (!options.some(o => o.isCorrect)) return "Đánh dấu ít nhất 1 đáp án đúng";
    if (options.every(o => o.isCorrect)) return "Không thể đánh dấu đúng cả mọi lựa chọn — bỏ tích ít nhất một ô sai";
    return null;
  }
  if (q.type === "MC" || q.type === "TRUE_FALSE_CLUSTER" || q.type === "SHORT_ANSWER") {
    if ((q.type === "MC") && options.some(o => !o.text.trim())) return "Có lựa chọn còn trống";
    if (q.type === "TRUE_FALSE_CLUSTER" && options.some(o => !o.text.trim())) return "Có ý còn trống";
    return validateQuestionOptions(q.type, options);
  }
  // ESSAY
  if (options.length > 0) return "Câu tự luận không có lựa chọn";
  const r = normalizeRubric(q.rubric ?? null);
  if (!r.ok) return r.error;
  if (r.rows.length > 0 && rubricTotal(r.rows) !== round2(q.points)) {
    return `Tổng điểm các tiêu chí (${fmt(rubricTotal(r.rows))}) phải bằng điểm của câu (${fmt(q.points)})`;
  }
  return null;
}

/** Dòng "Hợp lệ · 2 đáp án đúng, tổng 2 điểm" như Figma; câu chưa hợp lệ thì nêu lý do thay vì im lặng. */
export function describeValidity(q: QuizQuestionInput): { ok: boolean; message: string } {
  const err = validateQuizQuestion(q);
  if (err) return { ok: false, message: err };
  if (q.type === "MC_MULTI") return { ok: true, message: `Hợp lệ · ${q.options.filter(o => o.isCorrect).length} đáp án đúng, tổng ${fmt(q.points)} điểm` };
  if (q.type === "ESSAY") {
    const rows = normalizeRubric(q.rubric ?? null);
    const n = rows.ok ? rows.rows.length : 0;
    return { ok: true, message: n > 0 ? `Hợp lệ · ${n} tiêu chí chấm, tổng ${fmt(q.points)} điểm · chấm thủ công` : `Hợp lệ · chưa có tiêu chí chấm, ${fmt(q.points)} điểm · chấm thủ công` };
  }
  return { ok: true, message: `Hợp lệ · ${fmt(q.points)} điểm` };
}

/** Chữ quy tắc điểm cho câu nhiều đáp án — hiện cho gia sư và học sinh đọc cùng một luật, không có luật ngầm. */
export function multiRuleText(points: number): string {
  return `Chọn đúng và đủ mọi đáp án đúng, không chọn ô sai nào → nhận đủ ${fmt(points)} điểm. Thiếu hoặc chọn thừa → 0 điểm. Không trừ điểm âm, không chấm từng phần.`;
}

export { fmt as fmtPoints };
