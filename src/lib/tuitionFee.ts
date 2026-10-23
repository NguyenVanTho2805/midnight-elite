// HP-14..HP-17 (23/10/2026) — kiểu tính học phí MỚI, phần THUẦN (không Prisma, không node:*). Dùng chung máy chủ + giao diện;
// giao diện chỉ HIỂN THỊ kết quả các hàm này, không tự cộng/nhân tiền.
//
// Chủ chốt (QUYET-DINH-CHU mục 1): "Thêm cả kiểu tính mới" — nhưng
//   - chỉ áp cho lớp tạo SAU; lớp cũ giữ cách tính hiện tại (MonthlyCourseFee: gia sư nhập số buổi tháng) làm MẶC ĐỊNH;
//   - KHÔNG đụng phiếu đã chốt: số tiền chốt vào dòng FeeCharge lúc điểm danh, vào phiếu thì đóng băng;
//   - tiền là số nguyên đồng; làm tròn TỪNG BUỔI (nửa đồng làm tròn lên), không dồn sai số.
//
// Giả định cần kế toán/chủ xác nhận (ghi cả trong báo cáo): buổi tính phí = điểm danh "có mặt" hoặc "muộn" (cùng định nghĩa
// "buổi đã dạy" ở taughtSessions.ts). "Có phép"/"vắng" KHÔNG tính phí ở kiểu mới. Đó là DD-09, chủ chưa quyết — hàm
// isChargeableStatus là MỘT chỗ duy nhất để đổi khi chủ quyết.
import { isValidDateKey } from "@/lib/classSessions";

// ─── Hình thức học phí của lớp ───────────────────────────────────────────────
export const FEE_MODE_LEGACY = "monthly_sessions";
export const NEW_FEE_MODES = ["per_session", "per_hour", "per_course"] as const;
export type NewFeeMode = (typeof NEW_FEE_MODES)[number];
export type FeeMode = typeof FEE_MODE_LEGACY | NewFeeMode;
export const FEE_MODES: readonly FeeMode[] = [FEE_MODE_LEGACY, ...NEW_FEE_MODES];

export const FEE_MODE_LABEL: Record<FeeMode, string> = {
  monthly_sessions: "Theo số buổi trong tháng (cách hiện tại)",
  per_session: "Theo buổi",
  per_hour: "Theo giờ",
  per_course: "Theo khoá",
};
export const FEE_MODE_HINT: Record<FeeMode, string> = {
  monthly_sessions: "Cô tự nhập số buổi của từng tháng, như đang dùng. Phiếu cũ và lớp cũ không đổi.",
  per_session: "Mỗi buổi em có mặt hoặc đi muộn được tính một khoản bằng đơn giá một buổi, tự sinh khi cô điểm danh.",
  per_hour: "Mỗi buổi tính theo thời lượng buổi (phút) × đơn giá một giờ, tự sinh khi cô điểm danh. Làm tròn từng buổi đến đồng.",
  per_course: "Một khoản cho cả khoá, tính một lần cho mỗi em vào phiếu đầu tiên sau khi em vào lớp.",
};
export const FEE_RATE_UNIT: Record<NewFeeMode, string> = { per_session: "đ / buổi", per_hour: "đ / giờ", per_course: "đ / khoá" };

export function isNewFeeMode(v: unknown): v is NewFeeMode {
  return typeof v === "string" && (NEW_FEE_MODES as readonly string[]).includes(v);
}
/** Giá trị lạ / null (lớp cũ, cột chưa có) đều về cách cũ — an toàn nhất cho tiền. */
export function normalizeFeeMode(v: unknown): FeeMode {
  return isNewFeeMode(v) ? v : FEE_MODE_LEGACY;
}

/**
 * Mốc hiệu lực của đơn giá ĐẦU TIÊN của lớp: "từ khi tạo lớp" (đủ sớm để mọi buổi, kể cả buổi điểm danh bù ngày cũ, đều có giá).
 * Đặt mốc sớm thay vì ngày tạo lớp để đơn giá đổi sau — kể cả có hiệu lực lùi về trước ngày tạo — luôn thắng đơn giá đầu theo NGÀY.
 */
export const FEE_RATE_FROM_START = "2000-01-01";

export const FEE_RATE_MIN = 1_000;
export const FEE_RATE_MAX = 100_000_000;
export const SESSION_MINUTES_MIN = 15;
export const SESSION_MINUTES_MAX = 480;

export type FeeSetup = { mode: NewFeeMode; rate: number; sessionMinutes: number | null };
export function validateFeeSetup(i: { mode: unknown; rate: unknown; sessionMinutes?: unknown }): { ok: true; value: FeeSetup } | { ok: false; error: string } {
  if (!isNewFeeMode(i.mode)) return { ok: false, error: "Hình thức học phí phải là theo buổi, theo giờ hoặc theo khoá" };
  const rate = i.rate;
  if (typeof rate !== "number" || !Number.isInteger(rate) || rate < FEE_RATE_MIN || rate > FEE_RATE_MAX) {
    return { ok: false, error: `Đơn giá phải là số nguyên đồng từ ${FEE_RATE_MIN.toLocaleString("vi-VN")} đến ${FEE_RATE_MAX.toLocaleString("vi-VN")}` };
  }
  if (i.mode === "per_hour") {
    const m = i.sessionMinutes;
    if (typeof m !== "number" || !Number.isInteger(m) || m < SESSION_MINUTES_MIN || m > SESSION_MINUTES_MAX) {
      return { ok: false, error: `Thời lượng một buổi phải từ ${SESSION_MINUTES_MIN} đến ${SESSION_MINUTES_MAX} phút` };
    }
    return { ok: true, value: { mode: "per_hour", rate, sessionMinutes: m } };
  }
  return { ok: true, value: { mode: i.mode, rate, sessionMinutes: null } };
}

/** Ngày hiệu lực: YYYY-MM-DD hợp lệ (giờ VN). Việc so với hôm nay/quá khứ do nơi gọi quyết. */
export function validateEffectiveFrom(v: unknown): { ok: true; dateKey: string } | { ok: false; error: string } {
  if (typeof v !== "string" || !isValidDateKey(v)) return { ok: false, error: "Ngày hiệu lực phải có dạng năm-tháng-ngày (YYYY-MM-DD)" };
  return { ok: true, dateKey: v };
}

// ─── Buổi nào tính phí ───────────────────────────────────────────────────────
/** Một chỗ duy nhất quyết trạng thái điểm danh nào sinh học phí ở kiểu mới. Xem ghi chú đầu tệp (DD-09, chờ chủ). */
export function isChargeableStatus(status: string): boolean {
  return status === "present" || status === "late";
}

// ─── Chọn đơn giá theo ngày ──────────────────────────────────────────────────
export interface ClassRate { rate: number; sessionMinutes: number | null; effectiveFrom: string }
export interface StudentRate { rate: number; effectiveFrom: string }

/** Đơn giá lớp áp cho `dateKey`: dòng có effectiveFrom lớn nhất <= dateKey; buổi trước mọi mốc thì dùng mốc đầu tiên. Rỗng → null. */
export function pickClassRate<T extends { effectiveFrom: string }>(rows: readonly T[], dateKey: string): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
  let hit: T | null = null;
  for (const r of sorted) if (r.effectiveFrom <= dateKey) hit = r;
  return hit ?? sorted[0];
}
/** Đơn giá RIÊNG của em áp cho `dateKey`: chỉ khi đã có hiệu lực (không lấy mốc tương lai). Không có → null (dùng đơn giá lớp). */
export function pickStudentRate<T extends { effectiveFrom: string }>(rows: readonly T[], dateKey: string): T | null {
  let hit: T | null = null;
  for (const r of rows) if (r.effectiveFrom <= dateKey && (!hit || r.effectiveFrom > hit.effectiveFrom)) hit = r;
  return hit;
}

// ─── Tính tiền một buổi / một khoá ───────────────────────────────────────────
/** rate × phút / 60, làm tròn nửa lên, bằng số nguyên (không dùng số thực). */
export function hourlyAmount(ratePerHour: number, minutes: number): number {
  return Math.floor((ratePerHour * minutes * 2 + 60) / 120);
}

export interface FeeResult { amount: number; rate: number; units: number | null; rateSource: "class" | "student" }
export interface FeeInputs { mode: FeeMode; classRates: readonly ClassRate[]; studentRates: readonly StudentRate[] }

/** Học phí MỘT buổi. null = không sinh phí theo buổi (lớp cách cũ, theo khoá, hoặc chưa có đơn giá). */
export function sessionFee(i: FeeInputs & { dateKey: string }): FeeResult | null {
  if (i.mode !== "per_session" && i.mode !== "per_hour") return null;
  const cls = pickClassRate(i.classRates, i.dateKey);
  if (!cls) return null;
  const stu = pickStudentRate(i.studentRates, i.dateKey);
  const rate = stu ? stu.rate : cls.rate;
  const rateSource = stu ? "student" : "class";
  if (i.mode === "per_session") return { amount: rate, rate, units: null, rateSource };
  const minutes = cls.sessionMinutes;
  if (minutes == null || minutes <= 0) return null; // lớp theo giờ mà thiếu thời lượng: không đoán
  return { amount: hourlyAmount(rate, minutes), rate, units: minutes, rateSource };
}

/** Học phí cả khoá của MỘT em tại `dateKey` (ngày lập phiếu). null = lớp không phải theo khoá hoặc chưa có đơn giá. */
export function courseFee(i: FeeInputs & { dateKey: string }): FeeResult | null {
  if (i.mode !== "per_course") return null;
  const cls = pickClassRate(i.classRates, i.dateKey);
  if (!cls) return null;
  const stu = pickStudentRate(i.studentRates, i.dateKey);
  const rate = stu ? stu.rate : cls.rate;
  return { amount: rate, rate, units: null, rateSource: stu ? "student" : "class" };
}

// ─── Xem trước tác động khi đổi đơn giá (HP-16, HP-17) ──────────────────────
export interface ChargeLite { id: string; studentId: string; dateKey: string; amount: number; kind: string; invoiceId: string | null }
export interface RepriceUpdate { id: string; studentId: string; dateKey: string; from: number; to: number; rate: number; units: number | null; rateSource: "class" | "student" }
export interface RepricePlan {
  updates: RepriceUpdate[];
  /** Số dòng đổi tiền (đã lọc dòng không đổi). */
  changedCount: number;
  beforeTotal: number;
  afterTotal: number;
  delta: number;
  /** Dòng đã vào phiếu có ngày >= mốc: KHÔNG đổi (đóng băng). */
  frozenCount: number;
  frozenTotal: number;
  /** Dòng buổi chưa vào phiếu nhưng tính lại không ra tiền (thiếu đơn giá/thời lượng): giữ nguyên, báo để gia sư biết. */
  unresolvedCount: number;
  studentIds: string[];
}

/**
 * Tính lại các dòng buổi CHƯA vào phiếu, có ngày >= `fromDateKey`, theo bộ đơn giá MỚI (`next`). Dòng đã vào phiếu không bao giờ đổi.
 * Hàm này là nguồn số DUY NHẤT cho cả xem trước lẫn áp dụng, nên số xem trước = số ghi.
 */
export function planReprice(i: {
  mode: FeeMode;
  fromDateKey: string;
  charges: readonly ChargeLite[];
  next: { classRates: readonly ClassRate[]; studentRatesOf: (studentId: string) => readonly StudentRate[] };
}): RepricePlan {
  const updates: RepriceUpdate[] = [];
  let beforeTotal = 0, afterTotal = 0, frozenCount = 0, frozenTotal = 0, unresolvedCount = 0;
  const students = new Set<string>();
  for (const c of i.charges) {
    if (c.kind !== "session" || c.dateKey < i.fromDateKey) continue;
    if (c.invoiceId) { frozenCount++; frozenTotal += c.amount; continue; }
    const f = sessionFee({ mode: i.mode, dateKey: c.dateKey, classRates: i.next.classRates, studentRates: i.next.studentRatesOf(c.studentId) });
    if (!f) { unresolvedCount++; continue; }
    if (f.amount === c.amount) continue;
    beforeTotal += c.amount; afterTotal += f.amount;
    students.add(c.studentId);
    updates.push({ id: c.id, studentId: c.studentId, dateKey: c.dateKey, from: c.amount, to: f.amount, rate: f.rate, units: f.units, rateSource: f.rateSource });
  }
  return { updates, changedCount: updates.length, beforeTotal, afterTotal, delta: afterTotal - beforeTotal, frozenCount, frozenTotal, unresolvedCount, studentIds: [...students] };
}

// ─── Dòng phí trong phiếu ────────────────────────────────────────────────────
export interface ChargeRowForInvoice {
  courseId: string; courseName: string; kind: string; label: string | null; amount: number; units: number | null; rate: number | null; mode: string;
}
export interface ChargeLine {
  courseId: string; courseName: string; kind: string;
  /** Chữ hiển thị trên phiếu, vd "5 buổi × 150.000đ". */
  description: string;
  count: number;
  amount: number;
}
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

/** Gom các dòng phí cùng lớp, cùng loại, cùng đơn giá thành một dòng trên phiếu. Tổng các dòng = tổng các FeeCharge (không làm tròn lại). */
export function groupChargeLines(rows: readonly ChargeRowForInvoice[]): ChargeLine[] {
  const map = new Map<string, ChargeLine>();
  for (const r of rows) {
    const key = [r.courseId, r.kind, r.label ?? "", r.mode, r.rate ?? "", r.units ?? ""].join("|");
    const cur = map.get(key);
    if (cur) { cur.count++; cur.amount += r.amount; continue; }
    map.set(key, { courseId: r.courseId, courseName: r.courseName, kind: r.kind, description: "", count: 1, amount: r.amount });
  }
  const out: ChargeLine[] = [];
  for (const [key, line] of map) {
    const r = rows.find(x => [x.courseId, x.kind, x.label ?? "", x.mode, x.rate ?? "", x.units ?? ""].join("|") === key)!;
    if (r.kind === "session") {
      line.description = r.mode === "per_hour" && r.units != null && r.rate != null
        ? `${line.count} buổi × ${r.units} phút × ${vnd(r.rate)}/giờ`
        : `${line.count} buổi${r.rate != null ? ` × ${vnd(r.rate)}` : ""}`;
    } else if (r.kind === "course") {
      line.description = "Học phí cả khoá";
    } else {
      line.description = r.label ?? "Phí khác";
    }
    out.push(line);
  }
  return out.sort((a, b) => (a.courseName < b.courseName ? -1 : a.courseName > b.courseName ? 1 : a.description < b.description ? -1 : 1));
}

/**
 * Số phải đóng khi phiếu có cả cách cũ lẫn dòng phí mới.
 * chargesTotal = 0 (mọi phiếu của lớp cũ) → TRẢ ĐÚNG finalAmount của computeMonthlyFee, không tính lại — đảm bảo 0 đồng sai lệch.
 */
export function composeFinalAmount(legacy: { gross: number; scholarship: number; discount: number; finalAmount: number }, chargesTotal: number): number {
  if (chargesTotal === 0) return legacy.finalAmount;
  return Math.max(0, legacy.gross + chargesTotal - legacy.scholarship - legacy.discount);
}
