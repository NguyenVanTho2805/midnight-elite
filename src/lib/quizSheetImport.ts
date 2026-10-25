// QZ — nhập câu hỏi từ bảng Excel / CSV theo MẪU của KiN (tải ở "Nhập đề từ tệp"). THUẦN: nhận các hàng chữ, trả câu hỏi đã kiểm + lỗi TỪNG HÀNG.
// Chạy trên trình duyệt của gia sư (không gửi tệp đi đâu, không dùng AI, không tốn lượt AI). Kết quả vẫn đi qua bước rà soát từng câu như nhập từ PDF/Word.
//
// Nguyên tắc:
//  • Dòng đầu PHẢI là tiêu đề của bảng mẫu; không phải thì từ chối cả tệp (khỏi nhập nhầm tệp khác).
//  • Hàng lỗi KHÔNG bị bỏ âm thầm: trả trong `errors` kèm số hàng thật trong tệp và lý do. Hàng ví dụ của mẫu được nêu rõ là đã bỏ qua.
//  • Chỉ ĐỌC chữ: ô công thức lấy giá trị đã tính, không bao giờ chạy gì. Chữ trong ô là dữ liệu của đề, hiện ra qua MathText (đã escape).
//  • "Đáp án đúng" một chữ cái → 1 đáp án; nhiều chữ cái (A,C) → nhiều đáp án đúng (chấm đủ-hoặc-không như quiz).
import { validateQuizQuestion, type QuizQuestionInput, type QuizOptionInput } from "@/lib/quizQuestion";

export const SHEET_HEADERS = ["Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Điểm", "Giải thích", "Gợi ý"] as const;
export const SHEET_MAX_ROWS = 200;
export const SHEET_MAX_BYTES = 1024 * 1024;
/** Hàng ví dụ trong bảng mẫu bắt đầu bằng chữ này; nhập lên mà quên xoá thì bị bỏ qua và báo rõ. */
export const EXAMPLE_MARK = "(Ví dụ - xoá dòng này)";
export const SHEET_NAME = "Câu hỏi";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();

/** Chữ trong một ô: chuỗi, số, ngày, hoặc đối tượng ô của exceljs (công thức → giá trị đã tính, chữ định dạng, liên kết). Không bao giờ ném lỗi. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text?: unknown }[]; text?: unknown; result?: unknown; error?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map(r => (typeof r?.text === "string" ? r.text : "")).join("").trim();
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return cellText(o.text);
    if (o.error !== undefined) return "";
  }
  return "";
}

export interface SheetRowError { row: number; message: string }
export interface SheetParse { questions: QuizQuestionInput[]; errors: SheetRowError[]; total: number; fatal: string | null }

const LETTERS = ["A", "B", "C", "D"] as const;

function parsePoints(raw: string): { ok: true; value: number } | { ok: false } {
  if (!raw) return { ok: true, value: 1 };
  const t = raw.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false };
  const n = Number(t);
  return n > 0 && n <= 1000 ? { ok: true, value: Math.round(n * 100) / 100 } : { ok: false };
}

/** `rows` = mọi hàng của trang đầu (hàng 0 là tiêu đề). */
export function parseQuizSheet(rows: unknown[][]): SheetParse {
  const empty = (fatal: string): SheetParse => ({ questions: [], errors: [], total: 0, fatal });
  if (!Array.isArray(rows) || rows.length === 0) return empty("Tệp trống.");
  const head = (rows[0] ?? []).map(cellText);
  if (norm(head[0] ?? "") !== norm(SHEET_HEADERS[0]) || norm(head[5] ?? "") !== norm(SHEET_HEADERS[5])) {
    return empty("Dòng đầu chưa phải tiêu đề của bảng mẫu KiN (cột 1 “Câu hỏi”, cột 6 “Đáp án đúng”). Cô tải bảng mẫu rồi nhập câu hỏi vào đúng cột.");
  }
  const body = rows.slice(1);
  const nonEmpty = body.filter(r => (r ?? []).some(c => cellText(c)));
  if (nonEmpty.length > SHEET_MAX_ROWS) return empty(`Bảng có ${nonEmpty.length} hàng, nhiều hơn mức ${SHEET_MAX_ROWS} câu một lần. Cô tách thành nhiều tệp.`);

  const questions: QuizQuestionInput[] = [];
  const errors: SheetRowError[] = [];
  body.forEach((r, i) => {
    const row = i + 2; // số hàng thật trong tệp (hàng 1 là tiêu đề)
    const c = (r ?? []).map(cellText);
    if (c.every(x => !x)) return;
    const [text = "", a = "", b = "", cc = "", d = "", ansRaw = "", ptsRaw = "", explanation = "", hint = ""] = c;
    if (text.startsWith(EXAMPLE_MARK)) { errors.push({ row, message: "Hàng ví dụ của bảng mẫu, đã bỏ qua." }); return; }
    if (!text) { errors.push({ row, message: "Thiếu nội dung câu hỏi (cột 1)." }); return; }

    const cells = [a, b, cc, d];
    const options: QuizOptionInput[] = [];
    const indexOf: Record<string, number> = {};
    cells.forEach((t, k) => { if (t) { indexOf[LETTERS[k]] = options.length; options.push({ text: t, isCorrect: false }); } });
    if (options.length < 2) { errors.push({ row, message: "Cần ít nhất 2 đáp án (cột 2-5)." }); return; }

    const letters = ansRaw.toUpperCase().split(/[\s,;/+&]+/).map(x => x.trim()).filter(Boolean);
    if (letters.length === 0) { errors.push({ row, message: "Thiếu đáp án đúng (cột 6, ví dụ B hoặc A,C)." }); return; }
    const uniq = [...new Set(letters)];
    const badLetter = uniq.find(l => !(LETTERS as readonly string[]).includes(l));
    if (badLetter) { errors.push({ row, message: `Đáp án đúng “${ansRaw}” chưa hợp lệ (chỉ dùng A, B, C, D).` }); return; }
    const missing = uniq.find(l => indexOf[l] === undefined);
    if (missing) { errors.push({ row, message: `Đáp án đúng ${missing} trỏ vào ô đáp án đang để trống.` }); return; }
    uniq.forEach(l => { options[indexOf[l]].isCorrect = true; });

    const p = parsePoints(ptsRaw);
    if (!p.ok) { errors.push({ row, message: `Điểm “${ptsRaw}” chưa hợp lệ (số lớn hơn 0, tối đa 1000; để trống = 1 điểm).` }); return; }

    const q: QuizQuestionInput = {
      type: uniq.length > 1 ? "MC_MULTI" : "MC", text, points: p.value, options,
      explanation: explanation || null, hint: hint || null,
    };
    const bad = validateQuizQuestion(q);
    if (bad) { errors.push({ row, message: bad }); return; }
    questions.push(q);
  });
  return { questions, errors, total: nonEmpty.length, fatal: null };
}
