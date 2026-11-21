// SCL-C (21/11/2026) — sổ điểm gọn: bảng học sinh × bài (bài tập nộp tệp, quiz, đề Azota). PHẦN THUẦN: không DB, không React.
// Cùng hàm cho gia sư (sổ điểm) và học sinh (tab Kết quả) ⇒ hai bên không thể lệch nhau. Mỗi ô LUÔN có chữ trạng thái (không chỉ màu).
import { canDo, type CourseRole } from "@/lib/courseAccess";

export type CellState = "chua-nop" | "cho-cham" | "cho-duyet" | "da-cham";
export interface Cell { state: CellState; label: string; score: number | null; max: number | null }
export type ColumnKind = "bai-tap" | "quiz" | "azota";
export interface Column { id: string; kind: ColumnKind; title: string; max: number }

export const CELL_LABEL: Record<CellState, string> = { "chua-nop": "Chưa nộp", "cho-cham": "Chờ chấm", "cho-duyet": "Chờ duyệt", "da-cham": "Đã chấm" };
/** Học sinh đọc ô của mình: điểm tự khai chưa duyệt thì nói rõ là gia sư chưa duyệt. */
export const STUDENT_LABEL: Record<CellState, string> = { "chua-nop": "Chưa nộp", "cho-cham": "Chờ chấm", "cho-duyet": "Chờ gia sư duyệt", "da-cham": "Đã chấm" };
export const KIND_LABEL: Record<ColumnKind, string> = { "bai-tap": "Bài tập", quiz: "Quiz", azota: "Đề Azota" };

const cell = (state: CellState, score: number | null = null, max: number | null = null): Cell => ({ state, label: CELL_LABEL[state], score, max });

/** Bài tập nộp tệp: không bài nộp ⇒ Chưa nộp; nộp mà chưa có điểm ⇒ Chờ chấm; có điểm ⇒ Đã chấm. */
export function assignmentCell(sub: { score: number | null } | null | undefined, max: number): Cell {
  if (!sub) return cell("chua-nop");
  return sub.score === null ? cell("cho-cham") : cell("da-cham", sub.score, max);
}

/** Đề (quiz / Azota). `result` = dòng ExamResult đã lọc điểm bị giữ; `submitted` = có lượt làm đã nộp (quiz tự luận đang giữ điểm ⇒ chưa có result). */
export function examCell(result: { score: number; totalPoints: number; pendingReview: boolean } | null | undefined, submitted: boolean): Cell {
  if (result) return result.pendingReview ? cell("cho-duyet", result.score, result.totalPoints) : cell("da-cham", result.score, result.totalPoints);
  return submitted ? cell("cho-cham") : cell("chua-nop");
}

/** Duyệt / sửa / từ chối điểm và chấm điểm trong sổ: chỉ chủ lớp và Chủ nhiệm (ma trận courseAccess: `score.write`). */
export const canWriteScore = (role: CourseRole): boolean => canDo(role, "score.write");

/** Điểm gõ tay ("8", "8,5", "8.5"): số trong [0, max], làm tròn 2 chữ số; sai ⇒ null. */
export function parseScoreInput(raw: unknown, max: number): number | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

export type ReviewAction = "duyet" | "sua" | "tu-choi";
export const isReviewAction = (v: unknown): v is ReviewAction => v === "duyet" || v === "sua" || v === "tu-choi";

/** Câu báo sau 303 (?ghi=…). Không tên, không số. */
export const SO_DIEM_MESSAGE: Record<string, string> = {
  "da-duyet": "Đã duyệt điểm. Điểm này đã vào báo cáo và bảng xếp hạng của đề.",
  "da-sua": "Đã sửa và duyệt điểm.",
  "da-tu-choi": "Đã từ chối điểm tự khai. Học sinh có thể khai lại.",
  "da-cham": "Đã lưu điểm.",
  "da-giao": "Đã giao bài cho lớp. Bài hiện ở sổ điểm và trong lớp của học sinh.",
  "diem-sai": "Điểm chưa đúng. Nhập số từ 0 tới điểm tối đa của bài.",
  "khong-co": "Không tìm thấy điểm này, có thể đã được xử lý.",
};

// ── "+ Giao bài" thẳng (P2-2): lớp, tiêu đề, tệp đề hoặc quiz có sẵn, hạn nộp — không bắt gắn vào bài học. ──
export const GIAO_TITLE_MAX = 200;
export type GiaoInput =
  | { kind: "bai-tap"; courseId: string; title: string; dueKey: string | null }
  | { kind: "quiz"; courseId: string; examId: string };

/** Kiểm thân yêu cầu giao bài; trả câu lỗi tiếng Việt hoặc dữ liệu sạch. `isDateKey` truyền vào để phần này không phụ thuộc lịch. */
export function parseGiaoInput(b: unknown, isDateKey: (k: string) => boolean): { ok: true; v: GiaoInput } | { ok: false; error: string } {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const courseId = typeof o.courseId === "string" ? o.courseId.trim() : "";
  if (!courseId || courseId.length > 100) return { ok: false, error: "Chọn lớp sẽ giao bài." };
  if (o.kind === "quiz") {
    const examId = typeof o.examId === "string" ? o.examId.trim() : "";
    return examId && examId.length <= 100 ? { ok: true, v: { kind: "quiz", courseId, examId } } : { ok: false, error: "Chọn một quiz có sẵn." };
  }
  if (o.kind !== "bai-tap") return { ok: false, error: "Chọn loại bài." };
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) return { ok: false, error: "Nhập tiêu đề bài." };
  if (title.length > GIAO_TITLE_MAX) return { ok: false, error: `Tiêu đề tối đa ${GIAO_TITLE_MAX} ký tự.` };
  const due = typeof o.dueDate === "string" ? o.dueDate.trim() : "";
  if (due && !isDateKey(due)) return { ok: false, error: "Hạn nộp chưa đúng. Chọn lại ngày." };
  return { ok: true, v: { kind: "bai-tap", courseId, title, dueKey: due || null } };
}
