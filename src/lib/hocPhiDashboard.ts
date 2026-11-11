// HOCPHI-THEO-BUOI 3.4 — bảng học phí theo lớp × tháng. THUẦN: không Prisma, không node:*. Truy vấn nằm ở hocPhiDashboardServer.ts.
// Tháng = yearMonth DƯƠNG LỊCH giờ VN ("YYYY-MM", khoá FeeCharge.yearMonth), KHÔNG phải chu kỳ 15→14. Không tên / ID học sinh ở đầu ra.
import { FEE_MODE_LABEL, isNewFeeMode, normalizeFeeMode, type FeeMode } from "@/lib/tuitionFee";
import { effectiveFeeModeForMonth } from "@/lib/feeModeFloor";

export function isYearMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** "2026-01" → "2025-12". Đầu vào đã qua isYearMonth. */
export function prevYearMonth(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return m === 1 ? `${String(y - 1).padStart(4, "0")}-12` : `${ym.slice(0, 4)}-${String(m - 1).padStart(2, "0")}`;
}

/** Phần trăm chênh (số nguyên toán), 1 chữ số thập phân, làm tròn nửa RA XA số 0. prev ≤ 0 → null (UI hiện "Mới", không chia 0). */
export function pctChange(prev: number, cur: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) return null;
  const mag = Math.floor((Math.abs(cur - prev) * 2000 + prev) / (2 * prev)) / 10;
  return cur < prev && mag !== 0 ? -mag : mag;
}

export interface CourseInfo {
  id: string;
  name: string;
  feeMode: string;
  /** Chỉ cần mốc đầu (effectiveFrom) của đơn giá lớp để biết tháng nào còn tính cách cũ (phần B). Không có → không có mốc. */
  classRates?: ReadonlyArray<{ effectiveFrom: string }>;
  /** Cho trang quản trị gom theo gia sư; hàm này chỉ chuyển tiếp. */
  tutorId?: string | null;
}
export interface ChargeRow { courseId: string; studentId: string; kind: string; yearMonth: string; amount: number; invoiceId: string | null }
export interface ClosedSessionRow { courseId: string; date: Date | string }
export interface LegacyInvoiceRow { id: string; yearMonth: string; perSubject: ReadonlyArray<{ courseId?: string; subtotal?: number }> }

export interface MonthRow {
  courseId: string; courseName: string; feeMode: FeeMode; source: "fee_charge" | "invoice";
  closedSessions: number; students: number;
  /** null chỉ ở lớp cũ chưa lập phiếu trong tháng. */
  tuition: number | null; extra: number;
  prevTuition: number | null; delta: number | null; deltaPct: number | null;
  tutorId?: string | null;
}
export interface MonthTotals {
  tuition: number; extra: number; prevTuition: number; delta: number | null; deltaPct: number | null;
  closedSessions: number; invoiced: number; uninvoiced: number; inCancelledInvoice: number;
  perSession: number; legacyByInvoice: number;
}
export interface MonthTable { yearMonth: string; prevYearMonth: string; emptyMonth: boolean; rows: MonthRow[]; totals: MonthTotals }

export interface BuildInput {
  ym: string;
  courses: readonly CourseInfo[];
  /** Dòng phí của CẢ HAI tháng {ym, prev}. */
  charges: readonly ChargeRow[];
  /** Buổi đã chốt (state="closed"); chỉ buổi trong `ym` được đếm. `date` là 00:00 UTC của ngày VN → so toISOString().slice(0,7). */
  closedSessions: readonly ClosedSessionRow[];
  /** Phiếu không huỷ của cả hai tháng (chỉ để tính lớp cũ). */
  legacyInvoices: readonly LegacyInvoiceRow[];
  cancelledInvoiceIds?: ReadonlySet<string> | readonly string[];
  /** true: bỏ lớp không có gì ở cả hai tháng (không buổi chốt, không tiền, không phiếu). Mặc định false = đủ mọi lớp truyền vào. */
  hideInactive?: boolean;
}

// HP-LOP-TRUONG: "sheet" = học phí lớp theo bảng tháng (FeeCharge kind "sheet"). Số này là SAU học bổng / giảm trừ (Phải đóng), khác lớp theo buổi / khoá là TRƯỚC giảm:
// chú thích dưới bảng "Học phí theo tháng" nói rõ điều đó.
const TUITION_KINDS = new Set(["session", "course", "sheet"]);
const monthOfDate = (d: Date | string) => new Date(d).toISOString().slice(0, 7);

/** Học phí một lớp trong một tháng, theo hệ phí HIỆU LỰC của tháng đó. */
function courseMonth(c: CourseInfo, ym: string, charges: readonly ChargeRow[], invoices: readonly LegacyInvoiceRow[], cancelled: ReadonlySet<string>) {
  const mode = effectiveFeeModeForMonth(c.feeMode, c.classRates ?? [], ym);
  const mine = charges.filter(x => x.courseId === c.id && x.yearMonth === ym);
  const extra = mine.filter(x => x.kind === "extra").reduce((s, x) => s + x.amount, 0);
  if (isNewFeeMode(mode)) {
    const tuitionRows = mine.filter(x => TUITION_KINDS.has(x.kind));
    return {
      source: "fee_charge" as const, tuition: tuitionRows.reduce((s, x) => s + x.amount, 0) as number | null, extra,
      students: new Set(tuitionRows.map(x => x.studentId)).size, rows: tuitionRows,
    };
  }
  let subtotal = 0, invoiced = 0, students = 0;
  for (const inv of invoices) {
    if (inv.yearMonth !== ym || cancelled.has(inv.id)) continue;
    const parts = inv.perSubject.filter(p => p.courseId === c.id);
    if (parts.length === 0) continue;
    invoiced++;
    const sum = parts.reduce((s, p) => s + (p.subtotal ?? 0), 0);
    subtotal += sum;
    if (sum > 0) students++;
  }
  return { source: "invoice" as const, tuition: invoiced > 0 ? subtotal : null, extra, students, rows: [] as ChargeRow[] };
}

export function buildMonthTable(i: BuildInput): MonthTable {
  const ym = i.ym, prev = prevYearMonth(ym);
  const cancelled = new Set<string>(i.cancelledInvoiceIds ? Array.from(i.cancelledInvoiceIds) : []);
  const rows: MonthRow[] = [];
  let invoicedAmt = 0, uninvoicedAmt = 0, inCancelled = 0;

  for (const c of i.courses) {
    const cur = courseMonth(c, ym, i.charges, i.legacyInvoices, cancelled);
    const pre = courseMonth(c, prev, i.charges, i.legacyInvoices, cancelled);
    const closed = i.closedSessions.filter(s => s.courseId === c.id && monthOfDate(s.date) === ym).length;
    for (const ch of cur.rows) {
      if (ch.invoiceId === null) uninvoicedAmt += ch.amount;
      else if (cancelled.has(ch.invoiceId)) inCancelled += ch.amount;
      else invoicedAmt += ch.amount;
    }
    const prevTuition = pre.tuition;
    const hasPrev = prevTuition !== null && prevTuition > 0;
    const tuition = cur.tuition;
    const delta = hasPrev && tuition !== null ? tuition - prevTuition : null;
    const active = closed > 0 || (tuition ?? 0) !== 0 || cur.extra !== 0 || (prevTuition ?? 0) !== 0 || pre.extra !== 0 || (cur.source === "invoice" && tuition !== null);
    if (i.hideInactive && !active) continue;
    rows.push({
      courseId: c.id, courseName: c.name, feeMode: normalizeFeeMode(c.feeMode), source: cur.source,
      closedSessions: closed, students: cur.students, tuition, extra: cur.extra,
      prevTuition, delta, deltaPct: delta !== null && tuition !== null ? pctChange(prevTuition!, tuition) : null,
      ...(c.tutorId !== undefined ? { tutorId: c.tutorId } : {}),
    });
  }

  const sum = (f: (r: MonthRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const perSession = sum(r => (r.source === "fee_charge" ? (r.tuition ?? 0) : 0));
  const legacyByInvoice = sum(r => (r.source === "invoice" ? (r.tuition ?? 0) : 0));
  const tuition = perSession + legacyByInvoice;
  const prevTuition = sum(r => r.prevTuition ?? 0);
  const delta = prevTuition > 0 ? tuition - prevTuition : null;
  const totals: MonthTotals = {
    tuition, extra: sum(r => r.extra), prevTuition, delta, deltaPct: delta === null ? null : pctChange(prevTuition, tuition),
    closedSessions: sum(r => r.closedSessions),
    invoiced: invoicedAmt, uninvoiced: uninvoicedAmt, inCancelledInvoice: inCancelled, perSession, legacyByInvoice,
  };
  const emptyMonth = totals.closedSessions === 0 && tuition === 0 && totals.extra === 0 && rows.every(r => r.tuition === null || r.tuition === 0);
  return { yearMonth: ym, prevYearMonth: prev, emptyMonth, rows, totals };
}

/** Các hàng CSV (chưa BOM; dùng toCsv của revenue.ts). Cùng cột với JSON, số nguyên đồng, % một chữ số thập phân. Không có tên / ID học sinh. */
export function monthTableCsvRows(t: MonthTable): Array<Array<string | number | null>> {
  const head = ["Lớp", "Cách tính", "Nguồn", "Buổi đã chốt", "Số học sinh", "Học phí tháng (đ)", "Phí khác (đ)", "Tháng trước (đ)", "Chênh (đ)", "Chênh (%)"];
  const body = t.rows.map(r => [
    r.courseName, FEE_MODE_LABEL[r.feeMode], r.source === "invoice" ? "Cách cũ, theo phiếu" : "Theo buổi đã chốt",
    r.closedSessions, r.students, r.tuition, r.extra, r.prevTuition, r.delta, r.deltaPct,
  ]);
  const x = t.totals;
  return [head, ...body, ["Tổng", "", "", x.closedSessions, "", x.tuition, x.extra, x.prevTuition, x.delta, x.deltaPct]];
}
