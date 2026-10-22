// ĐX-04 (NC1-050) — số đo sức khoẻ sản phẩm cho quản trị. Hàm THUẦN: nhận các dòng đã lấy từ DB, trả số kèm mẫu số.
//
// Nguyên tắc (docs/kin/ke-hoach-phat-trien-tu-research.md, ĐX-04):
//  • Mỗi số đi kèm MẪU SỐ và định nghĩa ngay trên màn.
//  • Mẫu số dưới MIN_SAMPLE thì KHÔNG có tỉ lệ ("chưa đủ dữ liệu"): quy mô còn nhỏ, phần trăm trên mẫu nhỏ là ngộ nhận.
//  • Chỉ số tổng hợp. Không có tên học sinh hay tên gia sư ở bất kỳ đâu trong kết quả.
//  • Đây là số ĐO sản phẩm, không phải điểm của gia sư: không xếp hạng, không chỉ ra từng người.

export const MIN_SAMPLE = 10;
/** Một phiếu được coi là "đóng kịp" nếu đóng đủ trong chừng này ngày kể từ ngày gửi. */
export const PAY_WINDOW_DAYS = 14;
const DAY = 86_400_000;
/**
 * Hạn "điểm danh kịp thời": hết ngày VN HÔM SAU của buổi học. `AttendanceSession.date` lưu 00:00 UTC của ngày VN
 * (= 07:00 giờ VN cùng ngày), nên 00:00 giờ VN của ngày thứ ba tính từ buổi = date + 41 giờ.
 */
export const ON_TIME_AFTER_DATE_MS = 41 * 3_600_000;

export interface Ratio { n: number; d: number; enough: boolean; rate: number | null }
/** n ⊆ d do cách dựng nên không cắt n: nếu n > d thì đó là lỗi cần thấy, không phải che đi. */
export function ratio(n: number, d: number): Ratio {
  const enough = d >= MIN_SAMPLE;
  return { n, d, enough, rate: enough && d > 0 ? n / d : null };
}

/** Phần trăm nguyên để hiển thị. Không làm tròn lên 100% khi còn thiếu một ca, không làm tròn xuống 0% khi có ca. */
export function percentOf(r: Ratio): number | null {
  if (r.rate === null) return null;
  const p = Math.round(r.rate * 100);
  if (r.n === r.d) return 100;
  if (r.n === 0) return 0;
  return Math.min(99, Math.max(1, p));
}
export const ratioText = (r: Ratio): string => { const p = percentOf(r); return p === null ? "—" : `${p}%`; };
/** "288 / 400 phiếu đã gửi" */
export const sampleText = (r: Ratio, noun: string): string => `${r.n} / ${r.d} ${noun}`;
/** Câu giải thích khi chưa đủ mẫu. */
export const insufficientText = (r: Ratio, noun: string): string => `${r.d} ${noun} · cần từ ${MIN_SAMPLE} mới hiện phần trăm`;

// ─── Phiếu học phí (chỉ số 1, 2, 3) ───────────────────────────────────────────────────────────────────────────
export interface InvoiceRow {
  tutorId: string;
  status: string;
  sentAt: Date | null;
  zaloOpenedAt: Date | null;
  parentViewedAt: Date | null;
  paidAt: Date | null;
  /** Phiếu đã từng được cấp link riêng (gửi chat riêng). Gửi nhóm Zalo thì không có link riêng. */
  hasViewLink: boolean;
}
export interface InvoiceMetrics {
  /** Số phiếu đã gửi trong khoảng (không tính phiếu đã huỷ). */
  sent: number;
  zaloOpened: Ratio;
  parentViewed: Ratio;
  paidIn14: Ratio;
  /** Phiếu của chỉ số 3 phải đã gửi đủ 14 ngày nên lấy lứa phiếu lùi 14 ngày so với khoảng đang xem. */
  paidCohort: { from: Date; to: Date };
}
export function invoiceMetrics(rows: InvoiceRow[], now: Date, days: number): InvoiceMetrics {
  const sent = rows.filter(r => r.sentAt && r.status !== "cancelled") as (InvoiceRow & { sentAt: Date })[];
  const from = now.getTime() - days * DAY;
  const win = sent.filter(r => r.sentAt.getTime() >= from && r.sentAt.getTime() <= now.getTime());
  const opened = win.filter(r => r.zaloOpenedAt);
  const withLink = opened.filter(r => r.hasViewLink);
  const cohortFrom = new Date(from - PAY_WINDOW_DAYS * DAY), cohortTo = new Date(now.getTime() - PAY_WINDOW_DAYS * DAY);
  const cohort = sent.filter(r => r.sentAt.getTime() >= cohortFrom.getTime() && r.sentAt.getTime() <= cohortTo.getTime());
  const paidOnTime = cohort.filter(r => r.paidAt && r.paidAt.getTime() - r.sentAt.getTime() <= PAY_WINDOW_DAYS * DAY);
  return {
    sent: win.length,
    zaloOpened: ratio(opened.length, win.length),
    parentViewed: ratio(withLink.filter(r => r.parentViewedAt).length, withLink.length),
    paidIn14: ratio(paidOnTime.length, cohort.length),
    paidCohort: { from: cohortFrom, to: cohortTo },
  };
}

// ─── Khoản tiền vào (chỉ số 4) ────────────────────────────────────────────────────────────────────────────────
export interface TxRow { provider: string; status: string; occurredAt: Date }
export type TxClass = "auto" | "pending" | "manual" | "resolved" | "ignored" | "other";
/** Ghi tay (tiền mặt) xét trước: nó không đi qua SePay nên không có chuyện "tự gạch" hay "chờ". */
export function classifyTx(t: Pick<TxRow, "provider" | "status">): TxClass {
  if (t.provider === "manual") return "manual";
  if (t.status === "matched") return "auto";
  if (t.status === "pending") return "pending";
  if (t.status === "resolved") return "resolved";
  if (t.status === "ignored") return "ignored";
  return "other";
}
export interface BankMetrics {
  total: number;
  auto: number; pending: number; manual: number; resolved: number; ignored: number; other: number;
  /** Tỉ lệ tự gạch trong số khoản đi qua SePay (không tính tiền mặt ghi tay). */
  autoRate: Ratio;
  /** Tuổi (ngày tròn) của khoản đang chờ gia sư lâu nhất HIỆN NAY, không phụ thuộc khoảng đang xem. null = không có khoản nào đang chờ. */
  oldestPendingDays: number | null;
}
export function bankMetrics(rows: TxRow[], oldestPendingAt: Date | null, now: Date): BankMetrics {
  const c: Record<TxClass, number> = { auto: 0, pending: 0, manual: 0, resolved: 0, ignored: 0, other: 0 };
  for (const r of rows) c[classifyTx(r)]++;
  const viaSepay = rows.length - c.manual;
  return {
    total: rows.length, ...c,
    autoRate: ratio(c.auto, viaSepay),
    oldestPendingDays: oldestPendingAt ? Math.max(0, Math.floor((now.getTime() - oldestPendingAt.getTime()) / DAY)) : null,
  };
}

// ─── Điểm danh kịp thời (chỉ số 5) ────────────────────────────────────────────────────────────────────────────
export interface MarkRecord { status: string; createdAt: Date }
export interface SessionRow { date: Date; records: MarkRecord[] }
/**
 * Bản ghi "Có phép" do phụ huynh báo nghỉ trước được hệ thống tạo ngay lúc báo (có thể cả tuần trước buổi) nên KHÔNG phản ánh
 * lúc gia sư điểm danh. Hệ thống chỉ tự sinh bản ghi "excused" (absenceServer.markExcused); có mặt / muộn / vắng luôn do gia sư
 * chọn. Vì vậy chỉ cần lấy các bản ghi có trạng thái gia sư chọn, không cần dựa vào `updatedBy` (bản ghi cũ có thể rỗng).
 * Giới hạn: nếu gia sư sửa đè một bản ghi tự sinh thì `createdAt` vẫn là lúc tự sinh (hiếm: em báo nghỉ rồi vẫn đến học).
 */
const TUTOR_CHOSEN = ["present", "late", "absent"];
export function firstTutorMark(records: MarkRecord[]): Date | null {
  let best: Date | null = null;
  for (const r of records) {
    if (!TUTOR_CHOSEN.includes(r.status)) continue;
    if (!best || r.createdAt.getTime() < best.getTime()) best = r.createdAt;
  }
  return best;
}
export interface TimelinessMetric extends Ratio {
  /** Buổi chưa có bản ghi nào do gia sư chọn (chỉ có "Có phép" tự sinh): không đo được, không nằm trong mẫu số. */
  unmeasured: number;
}
export function timelinessMetric(rows: SessionRow[]): TimelinessMetric {
  let d = 0, n = 0, unmeasured = 0;
  for (const s of rows) {
    const first = firstTutorMark(s.records);
    if (!first) { unmeasured++; continue; }
    d++;
    if (first.getTime() <= s.date.getTime() + ON_TIME_AFTER_DATE_MS) n++;
  }
  return { ...ratio(n, d), unmeasured };
}

// ─── Gia sư đang dùng (chỉ số 6) ──────────────────────────────────────────────────────────────────────────────
export interface AdoptionMetrics {
  /** Gia sư đã duyệt, không bị khoá. */
  tutors: number;
  /** Trong số đó: có ít nhất một buổi đã dạy trong khoảng. */
  teaching: number;
  /** Trong số đó: gửi ít nhất một phiếu trong khoảng. */
  invoicing: number;
}
/** Giao với tập gia sư để tử số không vượt mẫu số (gia sư chưa duyệt, bị khoá… có dùng cũng không nằm trong số này). */
export function adoptionMetrics(tutorIds: string[], teachingIds: Array<string | null>, invoicingIds: Array<string | null>): AdoptionMetrics {
  const all = new Set(tutorIds);
  const inAll = (ids: Array<string | null>) => new Set(ids.filter((x): x is string => !!x && all.has(x))).size;
  return { tutors: all.size, teaching: inAll(teachingIds), invoicing: inAll(invoicingIds) };
}

// ─── Định nghĩa hiện trên màn ─────────────────────────────────────────────────────────────────────────────────
export type MetricKey = "zaloOpened" | "parentViewed" | "paidIn14" | "bank" | "timely" | "tutors";
export interface MetricDef { key: MetricKey; title: string; definition: string; denominator: string }
export const METRIC_ORDER: MetricKey[] = ["zaloOpened", "parentViewed", "paidIn14", "bank", "timely", "tutors"];
export const METRIC_DEFS: Record<MetricKey, MetricDef> = {
  zaloOpened: {
    key: "zaloOpened", title: "Phiếu gia sư đã mở Zalo",
    definition: "Bước gia sư bấm “Gửi phiếu qua Zalo”. KiN chỉ ghi “đã mở Zalo”, không biết tin có thật sự được gửi.",
    denominator: "phiếu đã gửi trong khoảng (không tính phiếu đã huỷ)",
  },
  parentViewed: {
    key: "parentViewed", title: "Phụ huynh đã xem phiếu",
    definition: "Phụ huynh mở link riêng /phieu/<mã>. Phiếu gửi vào nhóm Zalo không có link riêng nên không nằm trong mẫu số.",
    denominator: "phiếu đã mở Zalo và có link riêng",
  },
  paidIn14: {
    key: "paidIn14", title: `Đóng đủ trong ${PAY_WINDOW_DAYS} ngày`,
    definition: `Phiếu đã gửi và được đóng đủ trong vòng ${PAY_WINDOW_DAYS} ngày kể từ ngày gửi. Chỉ tính các phiếu đã gửi đủ ${PAY_WINDOW_DAYS} ngày, nên lứa phiếu lùi ${PAY_WINDOW_DAYS} ngày so với khoảng đang xem.`,
    denominator: "phiếu trong lứa đã gửi đủ 14 ngày",
  },
  bank: {
    key: "bank", title: "Khoản tiền vào",
    definition: "“Tự gạch” chỉ khi đúng mã và đúng số tiền còn lại (quy tắc GD-20). “Chờ gia sư” là tiền đã về nhưng chưa khớp phiếu nào. “Ghi tay” là tiền mặt gia sư tự ghi. Tỉ lệ tự gạch tính trên các khoản đi qua SePay.",
    denominator: "khoản tiền vào đi qua SePay trong khoảng",
  },
  timely: {
    key: "timely", title: "Điểm danh kịp thời",
    definition: "Buổi mà gia sư điểm danh lần đầu ngay trong ngày học hoặc ngày hôm sau (giờ Việt Nam). Chỉ đo các buổi ĐÃ có điểm danh; buổi quên hẳn hiện ở Hộp việc của gia sư. Bản ghi “Có phép” tự tạo khi phụ huynh báo nghỉ trước không tính.",
    denominator: "buổi đã có điểm danh trong khoảng",
  },
  tutors: {
    key: "tutors", title: "Gia sư đang dùng",
    definition: "Gia sư đã duyệt, không bị khoá, có ít nhất 1 buổi đã dạy (có em có mặt hoặc muộn) trong khoảng; và số gia sư gửi ít nhất 1 phiếu trong khoảng. Chỉ đếm số gia sư, không hiện tên.",
    denominator: "gia sư đã duyệt và không bị khoá",
  },
};
