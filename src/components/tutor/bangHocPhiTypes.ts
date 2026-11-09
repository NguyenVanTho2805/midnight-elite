// HP-LOP-TRUONG (09/11/2026) — kiểu phản hồi + hàm thuần của giao diện "bảng học phí tháng" (lớp feeMode = "monthly_sheet").
// Theo hợp đồng API mục 4.2 + 0a của docs/kin/phong-ban/dac-ta/HP-LOP-TRUONG.md. Giao diện CHỈ HIỂN THỊ: mọi số tiền do máy chủ tính (hocPhiSheet.ts),
// ở đây không cộng / nhân / làm tròn gì. Mọi hàm `norm*` chịu được thiếu trường (trường tuỳ chọn vắng → null / rỗng, không ném) vì hình dạng JSON
// chính xác do tut-code chốt sau; kiểu đúng ở đây là kiểu SAU khi chuẩn hoá.
import { useCallback, useSyncExternalStore } from "react";
import type { StatusTone } from "@/components/kin/Status";

// ─── Cách tính của lớp ─────────────────────────────────────────────────────────────────────────────────────────────
export const SHEET_FEE_MODE = "monthly_sheet";
/** Hàm boolean thường (KHÔNG phải type guard): `tuitionFee.ts` có thể chưa (hoặc đã) liệt kê giá trị này trong FeeMode, nên không thu hẹp kiểu. */
export const isSheetFeeMode = (v: unknown): boolean => v === SHEET_FEE_MODE;
export const SHEET_MODE_LABEL = "Theo bảng học phí tháng (nhập từ Excel)";
export const SHEET_MODE_HINT = "Cô đặt bảng bậc theo số môn một lần, rồi mỗi tháng nhập số buổi từng môn của từng em từ Excel hoặc Google Sheet. KiN cho xem trước, cô xác nhận mới ghi.";
/** Nhãn ngắn dùng ở bảng học phí tháng của gia sư (HocPhiThang). */
export const SHEET_MODE_SHORT = "Theo bảng học phí tháng";

// ─── Kiểu sau khi chuẩn hoá ────────────────────────────────────────────────────────────────────────────────────────
export interface SheetTier { subjects: number; rate: number }
export interface SheetConfig { subjects: string[]; tiers: SheetTier[]; periodStartDay: number }
export interface SheetPeriod { yearMonth: string; startDay: number; from: string | null; to: string | null; label: string }
export type SubjectCountSource = "file" | "counted";
export interface SheetInvoice { code: string; status: string; statusLabel: string; amountDue: number | null; paidAmount: number | null; remaining: number | null }
export interface SheetRow {
  studentId: string; name: string; filled: boolean; left: boolean;
  subjectCount: number | null; subjectCountSource: SubjectCountSource | null;
  sessions: Record<string, number>; freeSessions: number | null; rateOverride: number | null;
  scholarship: number | null; discount: number | null;
  tierRate: number | null; unitRate: number | null; billable: number | null; gross: number | null; net: number | null;
  note: string | null; source: string | null; locked: boolean; invoice: SheetInvoice | null;
  warnings: string[];
}
export interface SheetTotals { filled: number; unfilled: number; net: number }
export interface SheetData {
  feeMode: string; yearMonth: string; currentYearMonth: string | null; period: SheetPeriod | null;
  config: SheetConfig | null; suggestedConfig: SheetConfig | null; canEnable: boolean;
  rows: SheetRow[]; totals: SheetTotals;
}

// ─── Chuẩn hoá phòng thủ ───────────────────────────────────────────────────────────────────────────────────────────
type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");

export function normConfig(v: unknown): SheetConfig | null {
  if (!isObj(v)) return null;
  const tiers = arr(v.tiers).filter(isObj).map(t => ({ subjects: num(t.subjects) ?? 0, rate: num(t.rate) ?? 0 }));
  const day = num(v.periodStartDay);
  return { subjects: strList(v.subjects), tiers, periodStartDay: day != null && day >= 1 && day <= 28 ? day : 1 };
}
function normPeriod(v: unknown, ym: string): SheetPeriod | null {
  if (!isObj(v)) return null;
  const label = str(v.label);
  if (!label) return null;
  return { yearMonth: str(v.yearMonth) ?? ym, startDay: num(v.startDay) ?? 1, from: str(v.from), to: str(v.to), label };
}
function normInvoice(v: unknown): SheetInvoice | null {
  if (!isObj(v)) return null;
  return { code: str(v.code) ?? "", status: str(v.status) ?? "", statusLabel: str(v.statusLabel) ?? str(v.status) ?? "", amountDue: num(v.amountDue), paidAmount: num(v.paidAmount), remaining: num(v.remaining) };
}
function normSessions(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) { const n = num(x); if (n != null) out[k] = n; }
  return out;
}
function normSource(v: unknown): SubjectCountSource | null { return v === "file" || v === "counted" ? v : null; }

/** Các trường tính toán chung của một dòng (bảng tháng, xem trước, dryRun đều dùng). */
function calc(r: Raw) {
  return {
    subjectCount: num(r.subjectCount), subjectCountSource: normSource(r.subjectCountSource),
    sessions: normSessions(r.sessions), freeSessions: num(r.freeSessions), rateOverride: num(r.rateOverride),
    scholarship: num(r.scholarship), discount: num(r.discount),
    tierRate: num(r.tierRate), unitRate: num(r.unitRate), billable: num(r.billable), gross: num(r.gross), net: num(r.net),
  };
}
export type SheetCalc = ReturnType<typeof calc>;
export const normCalc = (v: unknown): SheetCalc => calc(isObj(v) ? v : {});

export function normRow(v: unknown): SheetRow | null {
  if (!isObj(v)) return null;
  const studentId = str(v.studentId);
  if (!studentId) return null;
  return {
    studentId, name: str(v.name) ?? "Học sinh", filled: v.filled === true, left: v.left === true,
    ...calc(v), note: str(v.note), source: str(v.source), locked: v.locked === true, invoice: normInvoice(v.invoice),
    warnings: strList(v.warnings ?? v.messages),
  };
}
export function normSheet(raw: unknown, fallbackYm = ""): SheetData {
  const r = isObj(raw) ? raw : {};
  const ym = str(r.yearMonth) ?? fallbackYm;
  const rows = arr(r.rows).map(normRow).filter((x): x is SheetRow => x !== null);
  const t = isObj(r.totals) ? r.totals : {};
  const filled = rows.filter(x => x.filled).length;
  return {
    feeMode: str(r.feeMode) ?? SHEET_FEE_MODE, yearMonth: ym, currentYearMonth: isYm(r.currentYearMonth) ? r.currentYearMonth : null, period: normPeriod(r.period, ym),
    config: normConfig(r.config), suggestedConfig: normConfig(r.suggestedConfig), canEnable: r.canEnable === true,
    rows, totals: { filled: num(t.filled) ?? filled, unfilled: num(t.unfilled) ?? rows.length - filled, net: num(t.net) ?? 0 },
  };
}

// ─── Xem trước nhập ────────────────────────────────────────────────────────────────────────────────────────────────
export type PreviewStatus = "ok" | "replace" | "unchanged" | "warn" | "error" | "unmatched" | "ambiguous" | "locked";
/** Bảy (tám) trạng thái của một dòng — luôn CHỮ + biểu tượng, màu chỉ làm rõ thêm. `writable`: có tự ghi được không (unmatched/ambiguous chỉ ghi được sau khi cô chọn em). */
export const PREVIEW_STATUS: Record<PreviewStatus, { label: string; icon: string; tone: StatusTone; hint: string }> = {
  ok:        { label: "Đúng",         icon: "✓", tone: "xong", hint: "Khớp một em và số hợp lệ" },
  replace:   { label: "Thay số cũ",   icon: "↻", tone: "cho",  hint: "Thay số đã nhập trước đó (chưa vào phiếu)" },
  unchanged: { label: "Không đổi",    icon: "=", tone: "mo",   hint: "Trùng số đã lưu, không cần ghi" },
  warn:      { label: "Cần xem",      icon: "!", tone: "cho",  hint: "Ghi được nhưng cô xem lại" },
  error:     { label: "Sai",          icon: "✕", tone: "loi",  hint: "Số sai, không ghi được" },
  unmatched: { label: "Không khớp",   icon: "?", tone: "loi",  hint: "Không có em này trong lớp" },
  ambiguous: { label: "Trùng tên",    icon: "≈", tone: "cho",  hint: "Có nhiều em cùng tên, cô chọn đúng em" },
  locked:    { label: "Đã vào phiếu", icon: "⊘", tone: "mo",   hint: "Học phí em này đã vào phiếu, không ghi đè" },
};
export const PREVIEW_ORDER: PreviewStatus[] = ["ok", "replace", "warn", "error", "unmatched", "ambiguous", "locked", "unchanged"];
export const isPreviewStatus = (v: unknown): v is PreviewStatus => typeof v === "string" && v in PREVIEW_STATUS;
/** Dòng cần cô xử lý trước khi ghi (sai, hoặc chưa chọn được em). */
export const needsAttention = (s: PreviewStatus) => s === "error" || s === "unmatched" || s === "ambiguous";

export interface PreviewCandidate { studentId: string; name: string; joinedOn: string | null; tail: string | null }
export interface PreviewRow extends SheetCalc {
  line: number; status: PreviewStatus; matchedBy: "code" | "name" | null; studentId: string | null; name: string;
  /** "Phải đóng" cũ của dòng sẽ bị thay (status replace). */
  before: number | null; messages: string[]; candidates: PreviewCandidate[];
}
export interface PreviewData {
  yearMonth: string; fileHash: string; fatal: string | null;
  columns: { matched: string[]; ignored: string[]; blocking: string[]; missingSubjects: string[] }; exampleLines: number[];
  counts: Partial<Record<PreviewStatus, number>>; writable: number; totalNet: number;
  rows: PreviewRow[]; rosterNotInFile: { studentId: string; name: string }[]; messages: string[];
}
function normCandidate(v: unknown): PreviewCandidate | null {
  if (!isObj(v)) return null;
  const id = str(v.studentId) ?? str(v.id);
  if (!id) return null;
  const tail = str(v.tail) ?? str(v.last4) ?? str(v.codeTail) ?? str(v.idTail);
  return { studentId: id, name: str(v.name) ?? "Học sinh", joinedOn: str(v.joinedOn) ?? str(v.joinedAt) ?? str(v.enrolledAt) ?? str(v.since), tail };
}
function normPreviewRow(v: unknown): PreviewRow | null {
  if (!isObj(v)) return null;
  const line = num(v.line);
  if (line == null) return null;
  const before = isObj(v.before) ? num(v.before.net) : num(v.before);
  return {
    line, status: isPreviewStatus(v.status) ? v.status : "error",
    matchedBy: v.matchedBy === "code" || v.matchedBy === "name" ? v.matchedBy : null,
    studentId: str(v.studentId), name: str(v.name) ?? "", ...calc(v), before,
    messages: strList(v.messages ?? v.warnings), candidates: arr(v.candidates).map(normCandidate).filter((x): x is PreviewCandidate => x !== null),
  };
}
export function normPreview(raw: unknown, fallbackYm = ""): PreviewData {
  const r = isObj(raw) ? raw : {};
  const cols = isObj(r.columns) ? r.columns : {};
  const fatal = typeof r.fatal === "string" ? r.fatal : isObj(r.fatal) ? (str(r.fatal.message) ?? str(r.fatal.error) ?? "Tệp bị từ chối") : null;
  const counts: Partial<Record<PreviewStatus, number>> = {};
  if (isObj(r.counts)) for (const k of Object.keys(PREVIEW_STATUS) as PreviewStatus[]) { const n = num(r.counts[k]); if (n != null) counts[k] = n; }
  const rows = arr(r.rows).map(normPreviewRow).filter((x): x is PreviewRow => x !== null);
  return {
    yearMonth: str(r.yearMonth) ?? fallbackYm, fileHash: str(r.fileHash) ?? "", fatal,
    columns: { matched: strList(cols.matched), ignored: strList(cols.ignored), blocking: strList(cols.blocking), missingSubjects: strList(cols.missingSubjects) },
    exampleLines: arr(r.exampleLines).filter((x): x is number => typeof x === "number"),
    counts, writable: num(r.writable) ?? 0, totalNet: num(r.totalNet) ?? 0, rows,
    rosterNotInFile: arr(r.rosterNotInFile).filter(isObj).map(x => ({ studentId: str(x.studentId) ?? "", name: str(x.name) ?? "Học sinh" })),
    messages: strList(r.messages),
  };
}

// ─── Hiển thị ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const vndText = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
export const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Chữ kỳ: dùng `period.label` do MÁY CHỦ trả ("kỳ 11/2026 (15/11 – 14/12)" hoặc "tháng 11/2026"); chưa có thì dựng chữ tháng từ khoá. */
export function periodText(period: SheetPeriod | null | undefined, ym: string): string {
  if (period?.label) return period.label;
  const [y, m] = ym.split("-");
  return m && y ? `tháng ${Number(m)}/${y}` : "tháng này";
}
export const isYm = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function shiftYm(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
/** Tháng dương lịch hiện tại giờ VN ("YYYY-MM") để giới hạn nút chuyển tháng (±12 tháng); máy chủ vẫn là nơi quyết (400 nếu quá). */
export function currentYmVn(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${p.find(x => x.type === "year")?.value}-${p.find(x => x.type === "month")?.value}`;
}
export const YM_RANGE_MONTHS = 12;
export const monthsBetween = (a: string, b: string) => { const [ya, ma] = a.split("-").map(Number); const [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma); };

/** Một dòng tóm tắt bảng bậc: "1 môn 70.000đ · 2 môn 60.000đ · … · Môn: Toán, Sử, Địa, Anh". */
export function tiersSummary(c: SheetConfig): string {
  const t = c.tiers.map(x => `${x.subjects} môn ${vndText(x.rate)}`).join(" · ");
  return `${t}${c.subjects.length ? ` · Môn: ${c.subjects.join(", ")}` : ""}`;
}
/** "Toán 8 · Anh 4" — chỉ môn có buổi; không môn nào thì "—". */
export function sessionsText(sessions: Record<string, number>, subjects: string[]): string {
  const keys = subjects.length ? subjects : Object.keys(sessions);
  const parts = keys.filter(k => (sessions[k] ?? 0) > 0).map(k => `${k} ${sessions[k]}`);
  return parts.length ? parts.join(" · ") : "—";
}
/** Chữ rất ngắn cho ô bảng / thẻ hẹp. */
export const sourceShort = (s: SubjectCountSource | null) => (s === "file" ? "ghi trong tệp" : s === "counted" ? "KiN đếm" : null);
export const sourceText = (s: SubjectCountSource | null) => (s === "file" ? "lấy từ cột Số môn trong tệp" : s === "counted" ? "đếm số môn có buổi" : null);

/** Khung nhập kiểm sớm ở trình duyệt (máy chủ vẫn là nơi quyết). Trả câu báo lỗi hoặc null. */
export function validateConfigDraft(d: { subjects: string[]; tiers: SheetTier[]; periodStartDay: number }): string | null {
  const names = d.subjects.map(s => s.trim());
  if (names.length < 1 || names.length > 6) return "Cô nhập từ 1 đến 6 môn.";
  if (names.some(n => n.length < 1 || n.length > 40)) return "Tên môn phải từ 1 đến 40 ký tự.";
  const keys = names.map(n => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " "));
  if (new Set(keys).size !== keys.length) return "Có hai môn trùng tên.";
  if (d.tiers.length < 1 || d.tiers.length > 8) return "Bảng bậc có từ 1 đến 8 dòng.";
  if (d.tiers[0].subjects !== 1) return "Dòng đầu của bảng bậc phải là 1 môn.";
  for (let i = 1; i < d.tiers.length; i++) if (d.tiers[i].subjects <= d.tiers[i - 1].subjects) return "Số môn của các bậc phải tăng dần.";
  if (d.tiers.some(t => !Number.isInteger(t.rate) || t.rate < 1_000 || t.rate > 100_000_000)) return "Đơn giá mỗi bậc là số nguyên đồng từ 1.000đ đến 100.000.000đ.";
  if (!Number.isInteger(d.periodStartDay) || d.periodStartDay < 1 || d.periodStartDay > 28) return "Ngày bắt đầu kỳ thu từ 1 đến 28.";
  return null;
}
/** Bậc tăng theo số môn (đơn giá bậc sau cao hơn bậc trước) — chỉ cảnh báo, không chặn. */
export const tiersAscending = (tiers: SheetTier[]) => tiers.some((t, i) => i > 0 && t.rate > tiers[i - 1].rate);

/** Chữ báo lỗi: ưu tiên câu tiếng Việt máy chủ trả, sau đó theo mã, sau đó theo mã HTTP. */
export function sheetErrorText(status: number, data: { error?: string; code?: string } | null | undefined): string {
  if (data?.error) return data.error;
  switch (data?.code) {
    case "NOT_SHEET_MODE": return "Lớp này chưa tính học phí theo bảng tháng.";
    case "NO_TABLE": return "Cô chưa đặt bảng bậc cho lớp này.";
    case "FILE_CHANGED": return "Tệp đã đổi, cô xem trước lại nhé.";
    case "HAS_ERRORS": return "Còn dòng sai. Cô chọn Bỏ qua dòng sai, hoặc sửa tệp rồi xem trước lại.";
    case "ROW_LOCKED": return "Học phí em này đã vào phiếu nên không sửa ở bảng được. Cô sửa số tiền ngay trên phiếu.";
    case "HAS_ROWS": return "Lớp đã có học phí nhập rồi nên không đổi ngày bắt đầu kỳ thu được.";
    case "HAS_MONEY_HISTORY": return "Lớp này đã có học phí tính theo cách khác nên không chuyển được. Cô tạo lớp mới nếu muốn dùng bảng tháng.";
    case "STUDENT_NOT_IN_COURSE": return "Em này không còn học ở lớp.";
    default: break;
  }
  switch (status) {
    case 0: return "Lỗi kết nối, cô thử lại sau.";
    case 401: return "Phiên đăng nhập đã hết, cô đăng nhập lại nhé.";
    case 403: return "Cô không có quyền làm việc này ở lớp này.";
    case 404: return "Không tìm thấy lớp hoặc em này.";
    case 413: return "Tệp quá lớn (tối đa 1 MB). Cô chia thành nhiều lần.";
    case 429: return "Cô thao tác nhanh quá, đợi một phút rồi thử lại.";
    case 503: return "Bản xem trước (thử nghiệm) không ghi được học phí.";
    default: return "Chưa làm được, cô thử lại sau.";
  }
}

// ─── Màn rộng / hẹp (bảng ↔ thẻ) ───────────────────────────────────────────────────────────────────────────────────
/** true khi cửa sổ rộng ≥ `min` px. Chỉ dùng sau khi dữ liệu đã tải (lần dựng trên máy chủ luôn là true, không có phần cần khớp). */
export function useMinWidth(min: number): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [min]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(`(min-width: ${min}px)`).matches, () => true);
}
/** md (768px) trở lên: dựng BẢNG; dưới md dựng THẺ. */
export const useIsWide = () => useMinWidth(768);
