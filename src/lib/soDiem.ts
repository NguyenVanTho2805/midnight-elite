// SCL-C (21/11/2026) — sổ điểm gọn: bảng học sinh × bài (bài tập nộp tệp, quiz, đề Azota). PHẦN THUẦN: không DB, không React.
// Cùng hàm cho gia sư (sổ điểm) và học sinh (tab Kết quả) ⇒ hai bên không thể lệch nhau. Mỗi ô LUÔN có chữ trạng thái (không chỉ màu).
import { canDo, type CourseRole } from "@/lib/courseAccess";

export type CellState = "chua-nop" | "cho-cham" | "cho-duyet" | "da-cham";
export interface Cell { state: CellState; label: string; score: number | null; max: number | null }
export type ColumnKind = "bai-tap" | "quiz" | "azota";
/** dueAt: hạn nộp (ISO) để báo "Quá hạn"; dueLabel: "Hạn 24/11" (bài tập) / "Ngày 12/11" (đề) ở đầu cột. */
export interface Column { id: string; kind: ColumnKind; title: string; max: number; dueAt?: string | null; dueLabel?: string | null }

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

// ── SCL-G-SD (21/11/2026, QUYET-DINH-GIAO-DIEN §2.3, §3.5): phần thuần của màn sổ điểm gia sư. ──
/** Trạng thái HIỆN ở ô: như CellState, thêm "qua-han" = chưa nộp mà đã qua hạn (§3.6). */
export type ShownState = CellState | "qua-han";
export const shownState = (c: Cell, col: Column, now: Date): ShownState =>
  c.state === "chua-nop" && col.dueAt && Date.parse(col.dueAt) < now.getTime() ? "qua-han" : c.state;

/** Điểm trong sổ: luôn có phần thập phân — 8 → "8,0", 8.5 → "8,5", 8.25 → "8,25". */
export function fmtDiem(n: number): string {
  const r = Math.round(n * 100);
  return (r / 100).toFixed(r % 10 === 0 ? 1 : 2).replace(".", ",");
}
/** Thang điểm ở đầu cột: "/10", "/7,5". */
export const fmtThang = (n: number) => `/${String(Math.round(n * 100) / 100).replace(".", ",")}`;

/** Trung bình thang 10 của một hàng: chỉ ô Đã chấm (điểm Chờ duyệt chưa tính). Không có ô nào ⇒ null. Làm tròn 1 chữ số. */
export function rowAverage(cells: Record<string, Cell>, cols: Column[]): number | null {
  const xs = cols.map(c => cells[c.id]).filter(x => x?.state === "da-cham" && x.score !== null && !!x.max).map(x => (x.score! / x.max!) * 10);
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

export type LocFilter = "cho-cham" | "cho-duyet" | "chua-nop" | "tat-ca";
export const LOC_FILTERS: { id: LocFilter; label: string }[] = [
  { id: "cho-cham", label: "Chờ chấm" }, { id: "cho-duyet", label: "Chờ duyệt" }, { id: "chua-nop", label: "Chưa nộp" }, { id: "tat-ca", label: "Tất cả" },
];
export const isLoc = (v: unknown): v is LocFilter => LOC_FILTERS.some(f => f.id === v);
/** Lọc theo HÀNG (§3.5): học sinh có ít nhất một ô ở trạng thái đó ("Chưa nộp" gồm cả Quá hạn). */
export const rowHas = (cells: Record<string, Cell>, loc: LocFilter): boolean => loc === "tat-ca" || Object.values(cells).some(c => c.state === loc);

/** Khoá một ô trong địa chỉ (?mo=): "<mã học sinh>~<mã cột>". */
export const cellKey = (studentId: string, colId: string) => `${studentId}~${colId}`;
export const isCellKey = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,100}~[\w-]{1,100}$/.test(v);

type QueueRow = { studentId: string; cells: Record<string, Cell & { submissionId?: string }> };
/** "Chấm N bài đang chờ": bài nộp chưa có điểm chấm được ngay trong sổ (quiz tự luận đang giữ điểm không có bài nộp ⇒ không vào).
 *  Theo cột rồi theo hàng: chấm hết một bài cho cả lớp rồi mới sang bài sau. */
export const cellQueue = (rows: QueueRow[], cols: Column[]): string[] =>
  cols.flatMap(c => rows.filter(r => r.cells[c.id]?.state === "cho-cham" && r.cells[c.id].submissionId).map(r => cellKey(r.studentId, c.id)));
/** Bài kế sau `cur` (cur có thể vừa chấm xong nên không còn trong hàng đợi); hết phía sau thì quay về đầu. Không còn bài nào khác ⇒ null. */
export function queueAfter(queue: string[], cur: string, rows: { studentId: string }[], cols: Column[]): string | null {
  const ri = new Map(rows.map((r, i) => [r.studentId, i])), ci = new Map(cols.map((c, i) => [c.id, i]));
  const pos = (k: string) => { const [s, c] = k.split("~"); return (ci.get(c) ?? -1) * rows.length + (ri.get(s) ?? -1); };
  const rest = queue.filter(k => k !== cur);
  return rest.find(k => pos(k) > pos(cur)) ?? rest[0] ?? null;
}

/** Chỗ quay về sau POST (303): điểm sai ⇒ mở lại đúng ô đó; chấm xong ⇒ mở bài kế (&tiep=1); việc khác ⇒ đóng hộp. `mo` rác bị bỏ. */
export function soDiemBack(courseId: string, ghi: string, mo: unknown): string {
  const base = `/lop-cua-toi/so-diem?lop=${encodeURIComponent(courseId)}&ghi=${ghi}`;
  if (!isCellKey(mo)) return base;
  return ghi === "diem-sai" ? `${base}&mo=${mo}` : ghi === "da-cham" ? `${base}&mo=${mo}&tiep=1` : base;
}

/** Chữ của một ô (nhãn trong bảng và ô CSV). */
export function cellText(c: Cell, s: ShownState): string {
  if (c.state === "da-cham" && c.score !== null) return fmtDiem(c.score);
  if (c.state === "cho-duyet" && c.score !== null) return `Chờ duyệt · ${fmtDiem(c.score)}`;
  return s === "qua-han" ? "Quá hạn" : CELL_LABEL[c.state];
}

/** Bảng chữ của "Xuất CSV": đầu cột = tên bài · hạn · thang, thêm cột Trung bình. Chỉ tên học sinh và điểm, không mã nào. */
export function gradebookCsvMatrix(cols: Column[], rows: { name: string; cells: Record<string, Cell> }[], now: Date): string[][] {
  const head = ["Học sinh", ...cols.map(c => [c.title, c.dueLabel, fmtThang(c.max)].filter(Boolean).join(" · ")), "Trung bình /10"];
  return [head, ...rows.map(r => {
    const avg = rowAverage(r.cells, cols);
    return [r.name, ...cols.map(c => (r.cells[c.id] ? cellText(r.cells[c.id], shownState(r.cells[c.id], c, now)) : "")), avg === null ? "" : fmtDiem(avg)];
  })];
}
/** Ô CSV luôn trong ngoặc kép; chữ mở đầu bằng = + - @ được thêm ' để bảng tính không chạy như công thức. */
export const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
/** CSV có BOM UTF-8 (Excel đọc đúng dấu tiếng Việt). */
export const toCsv = (m: string[][]) => "﻿" + m.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

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
