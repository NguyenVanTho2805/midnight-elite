// NC2-050 (góp ý 28/10: "tích hợp thêm tính năng tính điểm chuẩn, công thức do mình nhập, mình update, nhớ ghi mang tính tham khảo").
// THUẦN: không DB, không React. Test: tools/local-e2e/t-admission-formula-lib.ts.
//
// Công thức là CẤU HÌNH có cấu trúc, KHÔNG phải chuỗi để chạy (không eval, không biểu thức tự do):
//     điểm = (Σ trọng số môn × điểm môn) × hệ số nhân + Σ điểm cộng, kẹp trong [0, thang]
// Ví dụ khối có môn nhân đôi: Toán ×2, Lý ×1, Hoá ×1, hệ số nhân 0,75 (40 điểm quy về thang 30) + điểm ưu tiên (cộng sau).
// Quy tắc kho: không có con số nào hiện ra mà không có nguồn → công thức chỉ được CÔNG KHAI khi có đường dẫn nguồn; dòng "chưa đối chiếu" phải ghi rõ ở trang công khai.
// KiN không lưu điểm người dùng nhập (tính ở trình duyệt).
import { cleanSourceUrl, formatScore, parseScoreNumber, sourceNameFromUrl, SCALE_MAX, YEAR_MIN } from "@/lib/admissionScore";

export const FORMULA_NAME_MAX = 100;
export const FORMULA_SCHOOL_MAX = 120;
export const FORMULA_LABEL_MAX = 40;
export const FORMULA_NOTE_MAX = 400;
export const FORMULA_SOURCE_NAME_MAX = 80;
export const FORMULA_MAX_INPUTS = 8;
export const FORMULA_MAX_BONUSES = 4;
const MAX_SUBJECT = 1000;
const MAX_WEIGHT = 10;
const MAX_MULTIPLIER = 100;

/** Dòng chữ bắt buộc đi kèm MỌI kết quả tính. */
export const FORMULA_DISCLAIMER =
  "Kết quả chỉ mang tính tham khảo. Công thức do KiN nhập theo thông báo tuyển sinh của trường (xem nguồn); trường có thể đổi cách tính hoặc làm tròn khác. Hãy đối chiếu với thông báo chính thức của trường trước khi đăng ký nguyện vọng.";

export interface FormulaInput { key: string; label: string; max: number; weight: number }
export interface FormulaBonus { key: string; label: string; max: number }
export interface FormulaValue {
  name: string; school: string; year: number | null; scale: number;
  inputs: FormulaInput[]; multiplier: number; bonuses: FormulaBonus[];
  note: string; sourceUrl: string; sourceName: string; verified: boolean; published: boolean;
}
/** Dòng trả cho trang công khai (không có trường nội bộ). */
export interface PublicFormula {
  id: string; name: string; school: string; year: number | null; scale: number;
  inputs: FormulaInput[]; multiplier: number; bonuses: FormulaBonus[];
  note: string | null; sourceUrl: string; sourceName: string; verified: boolean;
}
export type FormulaParse = { ok: true; value: FormulaValue } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
const round = (n: number, d: number) => { const k = 10 ** d; return Math.round((n + Number.EPSILON) * k) / k; };
const decimals = (n: number, d: number) => round(n, d) === n;

function parseBool(v: unknown, fallback: boolean): boolean | null {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "TRUE") return true;
  if (v === "false" || v === "FALSE") return false;
  return null;
}

/** Điểm tối đa của phần môn theo công thức (chưa cộng điểm cộng). */
export function maxBase(f: Pick<FormulaValue, "inputs" | "multiplier">): number {
  return round(f.inputs.reduce((s, i) => s + i.weight * i.max, 0) * f.multiplier, 2);
}

/** Câu mô tả công thức bằng chữ: "(Toán × 2 + Lý + Hoá) × 0,75 + Ưu tiên". Luôn hiện cho người dùng để họ thấy cách tính. */
export function describeFormula(f: Pick<FormulaValue, "inputs" | "multiplier" | "bonuses">): string {
  const sum = f.inputs.map(i => (i.weight === 1 ? i.label : `${i.label} × ${formatScore(i.weight)}`)).join(" + ");
  const body = f.multiplier === 1 ? sum : `(${sum}) × ${String(f.multiplier).replace(".", ",")}`;
  return f.bonuses.length ? `${body} + ${f.bonuses.map(b => b.label).join(" + ")}` : body;
}

/** Kiểm một công thức do quản trị nhập. Nghiêm: sai là từ chối, không tự sửa số. Chỉ công khai khi có nguồn. */
export function parseFormulaInput(body: unknown, now: Date = new Date()): FormulaParse {
  if (!isObj(body)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const name = oneLine(body.name), school = oneLine(body.school), note = oneLine(body.note);
  if (!name) return { ok: false, error: "Thiếu tên công thức" };
  if (name.length > FORMULA_NAME_MAX) return { ok: false, error: `Tên công thức tối đa ${FORMULA_NAME_MAX} ký tự` };
  if (school.length > FORMULA_SCHOOL_MAX) return { ok: false, error: `Tên trường tối đa ${FORMULA_SCHOOL_MAX} ký tự` };
  if (note.length > FORMULA_NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${FORMULA_NOTE_MAX} ký tự` };

  let year: number | null = null;
  if (body.year !== undefined && body.year !== null && body.year !== "") {
    const y = typeof body.year === "string" && /^\d{4}$/.test(body.year.trim()) ? Number(body.year.trim()) : body.year;
    const maxYear = now.getUTCFullYear() + 1;
    if (typeof y !== "number" || !Number.isInteger(y) || y < YEAR_MIN || y > maxYear) return { ok: false, error: `Năm phải từ ${YEAR_MIN} đến ${maxYear} (hoặc để trống)` };
    year = y;
  }

  const scale = parseScoreNumber(body.scale);
  if (scale === null || !Number.isInteger(scale) || scale < 1 || scale > SCALE_MAX) return { ok: false, error: `Thang điểm phải là số nguyên từ 1 đến ${SCALE_MAX} (VD 30)` };

  const mul = body.multiplier === undefined || body.multiplier === null || body.multiplier === "" ? 1 : parseScoreNumber(body.multiplier);
  if (mul === null || mul <= 0 || mul > MAX_MULTIPLIER || !decimals(mul, 4)) return { ok: false, error: `Hệ số nhân phải lớn hơn 0, không quá ${MAX_MULTIPLIER}, tối đa 4 chữ số thập phân (VD 0,75)` };

  if (!Array.isArray(body.inputs) || body.inputs.length < 1) return { ok: false, error: "Cần ít nhất một môn / thành phần" };
  if (body.inputs.length > FORMULA_MAX_INPUTS) return { ok: false, error: `Tối đa ${FORMULA_MAX_INPUTS} môn / thành phần` };
  const inputs: FormulaInput[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of body.inputs.entries()) {
    if (!isObj(raw)) return { ok: false, error: `Môn thứ ${i + 1} không hợp lệ` };
    const label = oneLine(raw.label);
    if (!label) return { ok: false, error: `Môn thứ ${i + 1} chưa có tên` };
    if (label.length > FORMULA_LABEL_MAX) return { ok: false, error: `Tên môn thứ ${i + 1} tối đa ${FORMULA_LABEL_MAX} ký tự` };
    if (seen.has(label.toLowerCase())) return { ok: false, error: `Tên môn "${label}" bị trùng` };
    seen.add(label.toLowerCase());
    const max = parseScoreNumber(raw.max);
    if (max === null || max <= 0 || max > MAX_SUBJECT || !decimals(max, 2)) return { ok: false, error: `Điểm tối đa của "${label}" phải lớn hơn 0, không quá ${MAX_SUBJECT}, tối đa 2 chữ số thập phân` };
    const weight = raw.weight === undefined || raw.weight === null || raw.weight === "" ? 1 : parseScoreNumber(raw.weight);
    if (weight === null || weight <= 0 || weight > MAX_WEIGHT || !decimals(weight, 2)) return { ok: false, error: `Hệ số của "${label}" phải lớn hơn 0, không quá ${MAX_WEIGHT}, tối đa 2 chữ số thập phân` };
    inputs.push({ key: `m${i + 1}`, label, max, weight });
  }

  const bonusesRaw = body.bonuses === undefined || body.bonuses === null ? [] : body.bonuses;
  if (!Array.isArray(bonusesRaw)) return { ok: false, error: "Danh sách điểm cộng không hợp lệ" };
  if (bonusesRaw.length > FORMULA_MAX_BONUSES) return { ok: false, error: `Tối đa ${FORMULA_MAX_BONUSES} khoản điểm cộng` };
  const bonuses: FormulaBonus[] = [];
  for (const [i, raw] of bonusesRaw.entries()) {
    if (!isObj(raw)) return { ok: false, error: `Điểm cộng thứ ${i + 1} không hợp lệ` };
    const label = oneLine(raw.label);
    if (!label) return { ok: false, error: `Điểm cộng thứ ${i + 1} chưa có tên` };
    if (label.length > FORMULA_LABEL_MAX) return { ok: false, error: `Tên điểm cộng thứ ${i + 1} tối đa ${FORMULA_LABEL_MAX} ký tự` };
    if (seen.has(label.toLowerCase())) return { ok: false, error: `Tên "${label}" bị trùng với môn hoặc điểm cộng khác` };
    seen.add(label.toLowerCase());
    const max = parseScoreNumber(raw.max);
    if (max === null || max <= 0 || max > MAX_SUBJECT || !decimals(max, 2)) return { ok: false, error: `Mức tối đa của "${label}" phải lớn hơn 0, không quá ${MAX_SUBJECT}, tối đa 2 chữ số thập phân` };
    bonuses.push({ key: `b${i + 1}`, label, max });
  }

  const base = maxBase({ inputs, multiplier: mul });
  if (base > scale + 0.005) return { ok: false, error: `Điểm tối đa theo công thức (${formatScore(base)}) vượt thang ${scale} — kiểm tra hệ số của môn và hệ số nhân` };

  const published = parseBool(body.published, false), verified = parseBool(body.verified, false);
  if (published === null || verified === null) return { ok: false, error: "published / verified phải là đúng hoặc sai" };
  const urlRaw = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  let sourceUrl = "";
  if (urlRaw) {
    const u = cleanSourceUrl(urlRaw);
    if (!u) return { ok: false, error: "Đường dẫn nguồn không hợp lệ (chỉ nhận http/https, không kèm tên đăng nhập)" };
    sourceUrl = u;
  }
  if (published && !sourceUrl) return { ok: false, error: "Cần đường dẫn nguồn hợp lệ để công khai công thức — không công khai công thức không có nguồn" };
  const sourceName = sourceUrl ? oneLine(body.sourceName) || sourceNameFromUrl(sourceUrl) : "";
  if (sourceName.length > FORMULA_SOURCE_NAME_MAX) return { ok: false, error: `Tên nguồn tối đa ${FORMULA_SOURCE_NAME_MAX} ký tự` };

  return { ok: true, value: { name, school, year, scale, inputs, multiplier: mul, bonuses, note, sourceUrl, sourceName, verified, published } };
}

export type ComputeResult =
  | { ok: true; score: number; raw: number; capped: boolean; lines: string[] }
  | { ok: false; errors: Record<string, string> };

/**
 * Tính điểm theo công thức. `values` theo `key` của từng môn / điểm cộng ("m1", "b1"…), dạng số hoặc chữ ("8,5" / "8.5").
 * Môn nào cũng phải điền, nằm trong [0, tối đa], tối đa 2 chữ số thập phân; điểm cộng bỏ trống = 0. Sai thì trả lỗi từng ô, KHÔNG đoán số.
 * Kết quả làm tròn 2 chữ số, kẹp trong [0, thang] (`capped` = true và `raw` giữ số trước khi kẹp).
 */
export function computeScore(f: Pick<FormulaValue, "scale" | "inputs" | "multiplier" | "bonuses">, values: Record<string, string | number | undefined | null>): ComputeResult {
  const errors: Record<string, string> = {};
  const num = (v: string | number | undefined | null) => (typeof v === "string" && v.trim() === "" ? undefined : v === null ? undefined : v);
  const read = (key: string, label: string, max: number, required: boolean): number => {
    const v = num(values[key]);
    if (v === undefined) { if (required) errors[key] = `Chưa nhập điểm ${label}`; return 0; }
    const n = parseScoreNumber(v);
    if (n === null) { errors[key] = `Điểm ${label} phải là số (VD 8,5)`; return 0; }
    if (!decimals(n, 2)) { errors[key] = `Điểm ${label} tối đa 2 chữ số thập phân`; return 0; }
    if (n < 0 || n > max) { errors[key] = `Điểm ${label} phải từ 0 đến ${formatScore(max)}`; return 0; }
    return n;
  };
  const lines: string[] = [];
  let weighted = 0;
  for (const i of f.inputs) {
    const x = read(i.key, i.label, i.max, true);
    weighted += x * i.weight;
    lines.push(i.weight === 1 ? `${i.label}: ${formatScore(x)}` : `${i.label}: ${formatScore(x)} × ${formatScore(i.weight)} = ${formatScore(round(x * i.weight, 4))}`);
  }
  let bonus = 0;
  const bonusLines: string[] = [];
  for (const b of f.bonuses) {
    const x = read(b.key, b.label, b.max, false);
    bonus += x;
    if (x > 0) bonusLines.push(`${b.label}: +${formatScore(x)}`);
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const scaled = weighted * f.multiplier;
  if (f.multiplier !== 1) lines.push(`Tổng có hệ số: ${formatScore(round(weighted, 4))} × ${String(f.multiplier).replace(".", ",")} = ${formatScore(round(scaled, 4))}`);
  lines.push(...bonusLines);
  const raw = round(scaled + bonus, 2);
  const score = Math.min(Math.max(raw, 0), f.scale);
  return { ok: true, score, raw, capped: raw > f.scale, lines };
}
