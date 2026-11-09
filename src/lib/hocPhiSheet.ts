// HP-LOP-TRUONG — phần THUẦN của "học phí theo bảng tháng" (Course.feeMode = "monthly_sheet"): công thức, bảng bậc, kỳ thu, đọc lưới chữ từ Excel / Google Sheet,
// khớp học sinh, băm tệp. KHÔNG Prisma, KHÔNG node:* (giao diện cũng import được). Đặc tả: docs/kin/phong-ban/dac-ta/HP-LOP-TRUONG.md (mục 0a THẮNG mọi chỗ khác).
// Mọi số tiền là SỐ NGUYÊN ĐỒNG, không làm tròn ở đâu cả; máy chủ luôn tính lại, số khách gửi lên không được tin.
import Papa from "papaparse";
import { cleanText, normalizeKey } from "@/lib/tutorArea";
import { addDaysKey, isValidDateKey } from "@/lib/classSessions";
import { FEE_RATE_MAX, FEE_RATE_MIN } from "@/lib/tuitionFee";

// ─── Hằng số ─────────────────────────────────────────────────────────────────
export const INT32_MAX = 2_147_483_647;
export const SUBJECTS_MAX = 6;
export const SUBJECT_LABEL_MAX = 40;
export const TIERS_MAX = 8;
export const SESSIONS_PER_SUBJECT_MAX = 60;
export const SUBJECT_COUNT_MAX = 10;
export const MONEY_CELL_MAX = 1_000_000_000; // học bổng / giảm trừ: 1 tỷ đồng là trần hợp lý, dưới Int 32-bit
export const NOTE_MAX = 300;
export const NAME_MAX = 200;
export const SHEET_MAX_ROWS = 300;
export const SHEET_MAX_COLS = 40;
export const PERIOD_WINDOW = 12; // kỳ chọn được: quá 12 kỳ trước / sau kỳ hiện tại → 400
export const SHEET_EXAMPLE_MARK = "(Ví dụ - xoá dòng này)";

export interface Tier { subjects: number; rate: number }
export interface SheetConfig { subjects: string[]; tiers: Tier[]; periodStartDay: number }
export type CountSource = "file" | "counted";

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

// ─── Bảng bậc, môn, ngày bắt đầu kỳ ──────────────────────────────────────────
export function validateSubjects(raw: unknown): Ok<string[]> | Err {
  if (!Array.isArray(raw)) return { ok: false, error: "Danh sách môn phải là một mảng" };
  if (raw.length < 1 || raw.length > SUBJECTS_MAX) return { ok: false, error: `Lớp cần từ 1 đến ${SUBJECTS_MAX} môn` };
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") return { ok: false, error: "Tên môn phải là chữ" };
    const t = cleanText(x);
    if (t.length < 1 || t.length > SUBJECT_LABEL_MAX) return { ok: false, error: `Tên môn phải từ 1 đến ${SUBJECT_LABEL_MAX} ký tự` };
    const k = normalizeKey(t);
    if (!k) return { ok: false, error: `Tên môn “${t}” phải có chữ hoặc số` };
    if (seen.has(k)) return { ok: false, error: `Môn “${t}” bị trùng` };
    seen.add(k);
    out.push(t);
  }
  return { ok: true, value: out };
}

export function validateTiers(raw: unknown): Ok<Tier[]> | Err {
  if (!Array.isArray(raw)) return { ok: false, error: "Bảng bậc phải là một mảng" };
  if (raw.length < 1 || raw.length > TIERS_MAX) return { ok: false, error: `Bảng bậc cần từ 1 đến ${TIERS_MAX} dòng` };
  const out: Tier[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as { subjects?: unknown; rate?: unknown } | null;
    if (!t || typeof t !== "object") return { ok: false, error: `Bậc ${i + 1} không hợp lệ` };
    if (!isInt(t.subjects) || t.subjects < 1 || t.subjects > SUBJECT_COUNT_MAX) return { ok: false, error: `Bậc ${i + 1}: số môn phải là số nguyên từ 1 đến ${SUBJECT_COUNT_MAX}` };
    if (!isInt(t.rate) || t.rate < FEE_RATE_MIN || t.rate > FEE_RATE_MAX) return { ok: false, error: `Bậc ${i + 1}: đơn giá phải là số nguyên đồng từ ${vnd(FEE_RATE_MIN)} đến ${vnd(FEE_RATE_MAX)}` };
    if (i === 0 && t.subjects !== 1) return { ok: false, error: "Bậc đầu tiên phải là 1 môn" };
    if (i > 0 && t.subjects <= out[i - 1].subjects) return { ok: false, error: `Bậc ${i + 1}: số môn phải lớn hơn bậc trước` };
    out.push({ subjects: t.subjects, rate: t.rate });
  }
  return { ok: true, value: out };
}

export function validatePeriodStartDay(raw: unknown): Ok<number> | Err {
  if (!isInt(raw) || raw < 1 || raw > 28) return { ok: false, error: "Ngày bắt đầu kỳ thu phải là số nguyên từ 1 đến 28" };
  return { ok: true, value: raw };
}

/** Bậc có m lớn nhất mà m ≤ k. k lớn hơn bậc cuối → bậc cuối. k < bậc đầu (k < 1) → null. */
export function tierRateFor(tiers: readonly Tier[], k: number): number | null {
  let best: Tier | null = null;
  for (const t of tiers) if (t.subjects <= k && (!best || t.subjects > best.subjects)) best = t;
  return best ? best.rate : null;
}

/** Đọc JSON `tiers` từ DB (kiểu Json) về mảng bậc; sai hình dạng → mảng rỗng (không ném). */
export function readTiers(raw: unknown): Tier[] {
  const v = validateTiers(raw);
  return v.ok ? v.value : [];
}

// ─── Kỳ thu ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
export const isYearMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** "2026-11" + n tháng (n âm = lùi). */
export function shiftYearMonth(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const idx = y * 12 + (m - 1) + n;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${pad2((idx % 12) + 1)}`;
}
export function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)));
}

/** Kỳ hiện tại của lớp: khoá "YYYY-MM" = tháng chứa NGÀY BẮT ĐẦU kỳ. Hôm nay (ngày VN) chưa tới ngày bắt đầu của tháng này → vẫn ở kỳ bắt đầu từ tháng trước. */
export function currentPeriodId(todayVnDateKey: string, startDay: number): string {
  if (!isValidDateKey(todayVnDateKey)) throw new Error(`Ngày không hợp lệ: ${todayVnDateKey}`);
  const ym = todayVnDateKey.slice(0, 7);
  return Number(todayVnDateKey.slice(8, 10)) >= startDay ? ym : shiftYearMonth(ym, -1);
}

function rangeKeys(ym: string, startDay: number): { from: string; to: string } {
  const from = `${ym}-${pad2(startDay)}`;
  const next = shiftYearMonth(ym, 1);
  const to = startDay === 1 ? addDaysKey(`${next}-01`, -1) : `${next}-${pad2(startDay - 1)}`;
  return { from, to };
}

export function periodLabel(ym: string, startDay: number): string {
  const [y, m] = [ym.slice(0, 4), ym.slice(5, 7)];
  if (startDay === 1) return `tháng ${m}/${y}`;
  const r = rangeKeys(ym, startDay);
  const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
  return `kỳ ${m}/${y} (${dm(r.from)} – ${dm(r.to)})`;
}

/** [from, to] gồm cả hai đầu, "YYYY-MM-DD". start=1: cả tháng dương lịch; start=d: từ ngày d tới ngày d-1 của tháng sau. */
export function periodRange(ym: string, startDay: number): { from: string; to: string; label: string } {
  return { ...rangeKeys(ym, startDay), label: periodLabel(ym, startDay) };
}

/** FeeCharge.dateKey của dòng phí kỳ này. */
export const periodDateKey = (ym: string, startDay: number): string => `${ym}-${pad2(startDay)}`;

/** Kỳ chọn được: trong ±12 kỳ quanh kỳ hiện tại. */
export function periodInWindow(ym: string, current: string): boolean {
  return Math.abs(monthsBetween(current, ym)) <= PERIOD_WINDOW;
}

/** Nhãn dòng phí / dòng trên phiếu: "Học phí 11/2026 · 2 môn · 11 buổi" (+ " · đã trừ học bổng/giảm trừ" khi có trừ). Kỳ khác tháng: "Học phí kỳ 11/2026 · …". */
export function chargeLabel(ym: string, startDay: number, subjectCount: number, billable: number, deducted: boolean): string {
  const head = startDay === 1 ? `Học phí ${ym.slice(5, 7)}/${ym.slice(0, 4)}` : `Học phí kỳ ${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
  return `${head} · ${subjectCount} môn · ${billable} buổi${deducted ? " · đã trừ học bổng/giảm trừ" : ""}`;
}

// ─── Công thức (MỘT chỗ duy nhất) ────────────────────────────────────────────
export interface FeeInput {
  /** Số buổi theo nhãn môn, mỗi số nguyên 0..60. */
  sessions: Record<string, number>;
  /** Cột "Số môn" nếu có (nguồn "file"); null = đếm số môn có buổi (nguồn "counted"). */
  subjectCount: number | null;
  freeSessions: number;
  rateOverride: number | null;
  scholarship: number;
  discount: number;
}
export interface SheetWarning { code: "ZERO_NET" | "OVERRIDE_ABOVE_TIER"; message: string }
export interface SheetFee {
  subjectCount: number;
  subjectCountSource: CountSource;
  activeSubjects: number;
  totalSessions: number;
  freeSessions: number;
  billable: number;
  tierRate: number;
  unitRate: number;
  rateSource: "class" | "student";
  gross: number;
  deduction: number;
  net: number;
  warnings: SheetWarning[];
}

/**
 * Phải đóng = max(0, (tổng buổi − miễn phí) × đơn giá áp − học bổng − giảm trừ).
 * Đơn giá áp = đơn giá riêng nếu có, ngược lại đơn giá bậc theo k. k = cột "Số môn" nếu có (≥ số môn có buổi, ≤ 10), không thì số môn có buổi.
 * Học phí gốc vượt Int 32-bit → LỖI rõ (cột Prisma là Int; không bao giờ tràn âm thầm).
 */
export function computeSheetFee(tiers: readonly Tier[], i: FeeInput): Ok<SheetFee> | Err {
  if (tiers.length === 0) return { ok: false, error: "Lớp chưa có bảng bậc" };
  let total = 0, active = 0;
  for (const [label, n] of Object.entries(i.sessions)) {
    if (!isInt(n) || n < 0 || n > SESSIONS_PER_SUBJECT_MAX) return { ok: false, error: `Số buổi môn “${label}” phải là số nguyên từ 0 đến ${SESSIONS_PER_SUBJECT_MAX}` };
    total += n;
    if (n > 0) active++;
  }
  if (!isInt(i.freeSessions) || i.freeSessions < 0) return { ok: false, error: "Buổi miễn phí phải là số nguyên từ 0 trở lên" };
  if (i.freeSessions > total) return { ok: false, error: `Buổi miễn phí (${i.freeSessions}) nhiều hơn tổng số buổi (${total})` };
  if (i.rateOverride !== null && (!isInt(i.rateOverride) || i.rateOverride < FEE_RATE_MIN || i.rateOverride > FEE_RATE_MAX)) {
    return { ok: false, error: `Đơn giá riêng phải là số nguyên đồng từ ${vnd(FEE_RATE_MIN)} đến ${vnd(FEE_RATE_MAX)}. Muốn miễn hẳn, đặt Buổi miễn phí bằng tổng số buổi.` };
  }
  for (const [name, v] of [["Học bổng", i.scholarship], ["Giảm trừ", i.discount]] as const) {
    if (!isInt(v) || v < 0 || v > MONEY_CELL_MAX) return { ok: false, error: `${name} phải là số nguyên đồng từ 0 đến ${vnd(MONEY_CELL_MAX)}` };
  }
  let k: number, source: CountSource;
  if (i.subjectCount === null) { k = active; source = "counted"; }
  else {
    if (!isInt(i.subjectCount) || i.subjectCount < 0 || i.subjectCount > SUBJECT_COUNT_MAX) return { ok: false, error: `Số môn phải là số nguyên từ 0 đến ${SUBJECT_COUNT_MAX}` };
    if (i.subjectCount < active) return { ok: false, error: `Em học ${active} môn trong kỳ nhưng ghi số môn ${i.subjectCount}` };
    k = i.subjectCount; source = "file";
  }
  const tierRate = tierRateFor(tiers, k) ?? (total === 0 ? tiers[0].rate : null);
  if (tierRate === null) return { ok: false, error: "Số môn phải từ 1 trở lên khi có buổi học" };
  const unitRate = i.rateOverride ?? tierRate;
  const billable = total - i.freeSessions;
  const gross = billable * unitRate;
  if (gross > INT32_MAX) return { ok: false, error: `Học phí gốc ${vnd(gross)} vượt giới hạn ${vnd(INT32_MAX)}. Kiểm tra lại số buổi và đơn giá.` };
  const deduction = i.scholarship + i.discount;
  const net = Math.max(0, gross - deduction);
  const warnings: SheetWarning[] = [];
  if (net === 0) warnings.push({ code: "ZERO_NET", message: "Phải đóng 0đ nên KiN không tạo khoản phí cho em này." });
  if (i.rateOverride !== null && i.rateOverride > tierRate) warnings.push({ code: "OVERRIDE_ABOVE_TIER", message: `Đơn giá riêng ${vnd(i.rateOverride)} cao hơn đơn giá bậc ${vnd(tierRate)}.` });
  return {
    ok: true,
    value: { subjectCount: k, subjectCountSource: source, activeSubjects: active, totalSessions: total, freeSessions: i.freeSessions, billable, tierRate, unitRate, rateSource: i.rateOverride !== null ? "student" : "class", gross, deduction, net, warnings },
  };
}

/** Bỏ môn 0 buổi và sắp theo nhãn: dạng lưu vào CourseFeeSheetRow.sessions (so sánh "trùng hệt" ổn định). */
export function compactSessions(s: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(s).sort()) if (s[k] > 0) out[k] = s[k];
  return out;
}

// ─── Đầu vào sửa tay một em (PUT dong) ───────────────────────────────────────
export interface RowInput extends FeeInput { note: string | null }
const objectOf = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null);

/** `sessions` từ JSON: khoá phải khớp một môn của lớp (qua normalizeKey), giá trị số nguyên 0..60. Khoá lạ → lỗi (không bỏ âm thầm: mất tiền). */
export function parseSessionsInput(raw: unknown, subjects: readonly string[]): Ok<Record<string, number>> | Err {
  const o = objectOf(raw);
  if (!o) return { ok: false, error: "Số buổi từng môn phải là một đối tượng {môn: số buổi}" };
  const byKey = new Map(subjects.map(s => [normalizeKey(s), s]));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const label = byKey.get(normalizeKey(k));
    if (!label) return { ok: false, error: `Môn “${cleanText(k).slice(0, 40)}” không có trong bảng bậc của lớp` };
    if (label in out) return { ok: false, error: `Môn “${label}” bị ghi hai lần` };
    if (!isInt(v) || v < 0 || v > SESSIONS_PER_SUBJECT_MAX) return { ok: false, error: `Số buổi môn “${label}” phải là số nguyên từ 0 đến ${SESSIONS_PER_SUBJECT_MAX}` };
    out[label] = v;
  }
  return { ok: true, value: out };
}

export function parseRowInput(raw: unknown, subjects: readonly string[]): Ok<RowInput> | Err {
  const o = objectOf(raw);
  if (!o) return { ok: false, error: "Thân yêu cầu không hợp lệ" };
  const s = parseSessionsInput(o.sessions ?? {}, subjects);
  if (!s.ok) return s;
  const optInt = (v: unknown, def: number | null) => (v === undefined || v === null ? def : v);
  const subjectCount = optInt(o.subjectCount, null), freeSessions = optInt(o.freeSessions, 0), rateOverride = optInt(o.rateOverride, null);
  const scholarship = optInt(o.scholarship, 0), discount = optInt(o.discount, 0);
  for (const [name, v] of [["Số môn", subjectCount], ["Buổi miễn phí", freeSessions], ["Đơn giá riêng", rateOverride], ["Học bổng", scholarship], ["Giảm trừ", discount]] as const) {
    if (v !== null && !isInt(v)) return { ok: false, error: `${name} phải là số nguyên` };
  }
  let note: string | null = null;
  if (o.note !== undefined && o.note !== null) {
    if (typeof o.note !== "string") return { ok: false, error: "Ghi chú phải là chữ" };
    note = cleanText(o.note) || null;
    if (note && note.length > NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${NOTE_MAX} ký tự` };
  }
  return { ok: true, value: { sessions: s.value, subjectCount: subjectCount as number | null, freeSessions: freeSessions as number, rateOverride: rateOverride as number | null, scholarship: scholarship as number, discount: discount as number, note } };
}

// ─── Đọc ô ───────────────────────────────────────────────────────────────────
/** Ô tiền: "70000", "70.000", "70,000", "70 000" (đúng cụm nghìn, một loại dấu). Trống → value null. 70k, 1tr, 70.5, -5, chữ, ô công thức → lỗi. */
export function parseVndCell(raw: string): Ok<number | null> | Err {
  const t = cleanText(raw);
  if (!t) return { ok: true, value: null };
  if (/^[=+\-@]/.test(t)) return { ok: false, error: `“${t.slice(0, 20)}” không phải số tiền (ô bắt đầu bằng = + - @ được coi là chữ, KiN không chạy công thức)` };
  const m = /^(\d{1,12})$/.exec(t) ?? (/^\d{1,3}([., ])\d{3}(?:\1\d{3})*$/.test(t) ? [t, t.replace(/[., ]/g, "")] : null);
  if (!m) return { ok: false, error: `“${t.slice(0, 20)}” không phải số tiền nguyên đồng (viết 70000 hoặc 70.000, không dùng k / tr / số lẻ)` };
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n) || String(n).length > 12) return { ok: false, error: `“${t.slice(0, 20)}” quá lớn` };
  return { ok: true, value: n };
}
/** Ô đếm (số buổi, số môn): số nguyên không dấu 0..max. Trống → null. */
export function parseCountCell(raw: string, max: number): Ok<number | null> | Err {
  const t = cleanText(raw);
  if (!t) return { ok: true, value: null };
  if (/^[=+\-@]/.test(t)) return { ok: false, error: `“${t.slice(0, 20)}” không phải số (ô bắt đầu bằng = + - @ được coi là chữ, KiN không chạy công thức)` };
  if (!/^\d{1,3}$/.test(t)) return { ok: false, error: `“${t.slice(0, 20)}” không phải số nguyên` };
  const n = Number(t);
  if (n > max) return { ok: false, error: `${n} lớn hơn mức cho phép ${max}` };
  return { ok: true, value: n };
}

// ─── Đọc lưới chữ ────────────────────────────────────────────────────────────
type Field = "code" | "name" | "subjectCount" | "free" | "rate" | "scholarship" | "discount" | "note";
const HEADERS: Record<Field, string[]> = {
  code: ["ma em", "ma hoc sinh", "ma"],
  name: ["ho ten", "ten", "ho va ten", "hoc sinh", "ten hoc sinh", "ho ten hoc sinh"],
  subjectCount: ["so mon", "so mon dang ky"],
  free: ["buoi mien phi", "mien phi", "mien"],
  rate: ["don gia rieng", "don gia"],
  scholarship: ["hoc bong"],
  discount: ["giam tru"],
  note: ["ghi chu"],
};
export const FIELD_LABEL: Record<Field, string> = {
  code: "Mã em", name: "Họ tên", subjectCount: "Số môn", free: "Buổi miễn phí", rate: "Đơn giá riêng", scholarship: "Học bổng", discount: "Giảm trừ", note: "Ghi chú",
};
function fieldOfHeader(h: string): Field | null {
  const stripped = normalizeKey(h.replace(/\([^)]*\)/g, " "));
  const full = normalizeKey(h);
  for (const f of Object.keys(HEADERS) as Field[]) if (HEADERS[f].includes(stripped) || HEADERS[f].includes(full)) return f;
  return null;
}

export interface ParsedRow {
  /** Số dòng THẬT trong tệp / trong chữ dán (dòng 1 = dòng đầu tiên, kể cả tiêu đề và dòng trống). */
  line: number;
  code: string | null;
  name: string;
  sessions: Record<string, number>;
  subjectCount: number | null;
  freeSessions: number;
  rateOverride: number | null;
  scholarship: number;
  discount: number;
  note: string | null;
  errors: string[];
}
export interface ParsedSheet {
  fatal: string | null;
  columns: { matched: string[]; ignored: string[]; blocking: string[]; missingSubjects: string[] };
  rows: ParsedRow[];
  /** Dòng ví dụ của bảng mẫu (bắt đầu bằng SHEET_EXAMPLE_MARK) bị bỏ qua. */
  exampleLines: number[];
  total: number;
}

const emptyParsed = (fatal: string): ParsedSheet => ({ fatal, columns: { matched: [], ignored: [], blocking: [], missingSubjects: [] }, rows: [], exampleLines: [], total: 0 });

/** Chữ (CSV / TSV / dán từ Google Sheet) → lưới. Có TAB thì tách bằng TAB (Google Sheet / Excel); không thì tự nhận dấu tách. Dòng i của lưới = dòng i+1 của chữ. */
export function textToGrid(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const r = Papa.parse<string[]>(t, { delimiter: t.includes("\t") ? "\t" : "", skipEmptyLines: false, quoteChar: '"' });
  return r.data.filter((x): x is string[] => Array.isArray(x)).map(row => row.map(c => String(c ?? "")));
}

export function parseSheetGrid(grid: readonly (readonly string[])[], subjects: readonly string[]): ParsedSheet {
  const clean = grid.map(r => r.map(c => cleanText(String(c ?? ""))));
  const firstIdx = clean.findIndex(r => r.some(c => c));
  if (firstIdx < 0) return emptyParsed("Tệp trống: KiN không thấy dòng nào có chữ.");
  if (clean.some(r => r.slice(SHEET_MAX_COLS).some(c => c))) return emptyParsed(`Tệp có hơn ${SHEET_MAX_COLS} cột. Xoá bớt cột thừa rồi chọn lại.`);
  const header = clean[firstIdx].slice(0, SHEET_MAX_COLS);

  const subjectByKey = new Map(subjects.map(s => [normalizeKey(s), s]));
  const colField: (Field | null)[] = [], colSubject: (string | null)[] = [], colLabel: string[] = [];
  const usedField = new Set<Field>(), usedSubject = new Set<string>();
  header.forEach((h, j) => {
    let f: Field | null = null, s: string | null = null;
    if (h) {
      s = subjectByKey.get(normalizeKey(h)) ?? null;
      if (!s) f = fieldOfHeader(h);
      if (s && usedSubject.has(s)) s = null; else if (s) usedSubject.add(s);
      if (f && usedField.has(f)) f = null; else if (f) usedField.add(f);
    }
    colField.push(f); colSubject.push(s); colLabel.push(h || `Cột ${j + 1}`);
  });
  if (!usedField.has("name") && !usedField.has("code")) {
    return emptyParsed("KiN không thấy cột “Họ tên” hoặc “Mã em” ở dòng đầu. Đặt tên cột đúng như bảng mẫu.");
  }

  // Dòng dữ liệu: mọi dòng sau tiêu đề có ít nhất một ô chữ. Dòng ví dụ của bảng mẫu bỏ qua và báo.
  const dataLines: { line: number; cells: string[] }[] = [];
  const exampleLines: number[] = [];
  for (let r = firstIdx + 1; r < clean.length; r++) {
    const cells = clean[r].slice(0, SHEET_MAX_COLS);
    if (!cells.some(c => c)) continue;
    if (cells.some(c => c.startsWith(SHEET_EXAMPLE_MARK))) { exampleLines.push(r + 1); continue; }
    dataLines.push({ line: r + 1, cells });
  }

  const matched: string[] = [], ignored: string[] = [], blocking: string[] = [];
  header.forEach((h, j) => {
    if (colField[j]) matched.push(FIELD_LABEL[colField[j]!]);
    else if (colSubject[j]) matched.push(colSubject[j]!);
    else {
      const hasData = dataLines.some(l => l.cells[j]);
      if (hasData) blocking.push(colLabel[j]);
      else if (h) ignored.push(h);
    }
  });
  const missingSubjects = subjects.filter(s => !usedSubject.has(s));
  const base = { matched, ignored, blocking, missingSubjects };
  if (blocking.length) {
    const names = blocking.map(b => `“${b}”`).join(", ");
    return { fatal: `Cột ${names} có dữ liệu nhưng không khớp môn hay cột nào của lớp. Thêm môn vào bảng bậc hoặc xoá cột rồi chọn lại.`, columns: base, rows: [], exampleLines, total: dataLines.length };
  }
  if (dataLines.length === 0) return { fatal: "Tệp chỉ có dòng tiêu đề, chưa có học sinh nào.", columns: base, rows: [], exampleLines, total: 0 };
  if (dataLines.length > SHEET_MAX_ROWS) {
    return { fatal: `Tối đa ${SHEET_MAX_ROWS} dòng mỗi lần nhập (đang có ${dataLines.length}). Chia thành nhiều lần.`, columns: base, rows: [], exampleLines, total: dataLines.length };
  }

  const rows: ParsedRow[] = dataLines.map(({ line, cells }) => {
    const row: ParsedRow = { line, code: null, name: "", sessions: {}, subjectCount: null, freeSessions: 0, rateOverride: null, scholarship: 0, discount: 0, note: null, errors: [] };
    const at = (col: string, msg: string) => row.errors.push(`Dòng ${line}, cột “${col}”: ${msg}`);
    for (let j = 0; j < header.length; j++) {
      const v = cells[j] ?? "";
      const f = colField[j], s = colSubject[j];
      if (s) {
        if (!v) continue;
        const r = parseCountCell(v, SESSIONS_PER_SUBJECT_MAX);
        if (!r.ok) at(colLabel[j], r.error); else if (r.value !== null) row.sessions[s] = r.value;
      } else if (f === "code") row.code = v || null;
      else if (f === "name") row.name = v;
      else if (f === "note") { if (v.length > NOTE_MAX) at(colLabel[j], `quá ${NOTE_MAX} ký tự`); else row.note = v || null; }
      else if (f === "subjectCount") { const r = parseCountCell(v, SUBJECT_COUNT_MAX); if (!r.ok) at(colLabel[j], r.error); else row.subjectCount = r.value; }
      else if (f === "free") { const r = parseCountCell(v, SESSIONS_PER_SUBJECT_MAX * SUBJECTS_MAX); if (!r.ok) at(colLabel[j], r.error); else row.freeSessions = r.value ?? 0; }
      else if (f === "rate" || f === "scholarship" || f === "discount") {
        const r = parseVndCell(v);
        if (!r.ok) at(colLabel[j], r.error);
        else if (f === "rate") row.rateOverride = r.value;
        else row[f] = r.value ?? 0;
      }
    }
    if (row.name.length > NAME_MAX) { row.errors.push(`Dòng ${line}: họ tên quá ${NAME_MAX} ký tự`); row.name = row.name.slice(0, 40); }
    if (row.code && row.code.length > 100) { row.errors.push(`Dòng ${line}: mã em quá dài`); row.code = null; }
    if (!row.name && !row.code) row.errors.push(`Dòng ${line}: thiếu họ tên và mã em`);
    return row;
  });
  return { fatal: null, columns: base, rows, exampleLines, total: rows.length };
}

// ─── Khớp học sinh ───────────────────────────────────────────────────────────
export interface RosterEntry { studentId: string; name: string; joinedAt?: string | null }
export type MatchResult =
  | { status: "matched"; studentId: string; matchedBy: "code" | "name" }
  | { status: "unmatched" }
  | { status: "ambiguous"; candidates: { studentId: string; name: string; joinedAt: string | null; tail: string }[] };

/** `roster` = CHỈ em đang `active` của lớp. Mã em thắng tên; mã lạ → unmatched (không quay sang tên). Không đoán gần đúng, không tự chọn khi trùng tên. */
export function matchRoster(r: { code: string | null; name: string }, roster: readonly RosterEntry[]): MatchResult {
  if (r.code) {
    const hit = roster.find(x => x.studentId === r.code);
    return hit ? { status: "matched", studentId: hit.studentId, matchedBy: "code" } : { status: "unmatched" };
  }
  const key = normalizeKey(r.name);
  if (!key) return { status: "unmatched" };
  const hits = roster.filter(x => normalizeKey(x.name) === key);
  if (hits.length === 1) return { status: "matched", studentId: hits[0].studentId, matchedBy: "name" };
  if (hits.length === 0) return { status: "unmatched" };
  return { status: "ambiguous", candidates: hits.map(h => ({ studentId: h.studentId, name: h.name, joinedAt: h.joinedAt ?? null, tail: h.studentId.slice(-4) })) };
}

// ─── Băm tệp ─────────────────────────────────────────────────────────────────
/** JSON ổn định: khoá đối tượng được sắp, mảng giữ thứ tự. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

const K256: number[] = [];
const H256: number[] = [];
(() => {
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p !== 0)) primes.push(n);
  for (const p of primes) K256.push(Math.floor((Math.cbrt(p) % 1) * 2 ** 32) >>> 0);
  for (const p of primes.slice(0, 8)) H256.push(Math.floor((Math.sqrt(p) % 1) * 2 ** 32) >>> 0);
})();

/** SHA-256 thuần JS (không node:crypto, để dùng được cả ở trình duyệt). Trả chữ số hex 64 ký tự. */
export function sha256Hex(msg: string): string {
  const bytes = new TextEncoder().encode(msg);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  const h = H256.slice();
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map(x => x.toString(16).padStart(8, "0")).join("");
}

/** "sha256:<hex>" của một giá trị JSON (khoá đối tượng được sắp nên đổi thứ tự khoá không đổi băm). */
export function hashSheet(value: unknown): string {
  return `sha256:${sha256Hex(stableStringify(value))}`;
}
