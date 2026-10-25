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

// ─── Gia sư mới vào: kích hoạt (chỉ số 7, 8, 9 — NC2-020) ─────────────────────────────────────────────────────
/** Chỉ số 7: lớp đầu tiên phải được tạo trong chừng này giờ kể từ lúc đăng ký. */
export const ACTIVATION_CLASS_HOURS = 24;
/** Chỉ số 8: buổi đã dạy đầu tiên phải có trong chừng này ngày kể từ lúc đăng ký. */
export const ACTIVATION_TEACH_DAYS = 7;
const HOUR = 3_600_000;
/** Giờ chữ "08:00:00" mà POST /api/courses luôn ghi kèm ngày (xem parseCourseCreatedAt). */
const COURSE_DEFAULT_HOUR_VN = 8;

/** Ngày VN (yyyy-mm-dd) của một thời điểm — cùng quy ước với vnDateKeyOf ở classSessions.ts nhưng tự chứa để tệp này thuần. */
function vnKey(t: Date): string { return new Date(t.getTime() + 7 * HOUR).toISOString().slice(0, 10); }

/**
 * `Course.createdAt` là CHUỖI và có ba dạng thật trong DB:
 *  • "22/10/2026 08:00:00" — POST /api/courses (toLocaleDateString("vi-VN") + giờ chữ cố định 08:00:00);
 *  • "22/10/2026"          — nhân bản lớp (chỉ có ngày);
 *  • ISO "2026-10-22T03:12:00.000Z" — dữ liệu nhập / bài test.
 * Dạng ISO có giờ thật. Hai dạng dd/mm/yyyy chỉ tin được NGÀY (giờ chữ là hằng số, không phải lúc bấm tạo), nên với chúng trả về
 * 08:00 giờ VN của ngày đó. Hệ quả nói thẳng ở màn: lớp đầu tính theo NGÀY ghi trên lớp, sai số tới cỡ một ngày.
 * Không parse được → null (lớp đó bị bỏ qua, không đoán).
 */
export function parseCourseCreatedAt(raw: string | null | undefined): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const vi = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s);
  if (vi) {
    const d = Number(vi[1]), m = Number(vi[2]), y = Number(vi[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const t = new Date(Date.UTC(y, m - 1, d, COURSE_DEFAULT_HOUR_VN - 7, 0, 0));
    return t.getUTCDate() === d ? t : null; // 31/02 bị JS đẩy sang tháng sau → bỏ
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const hasTime = /T\d{2}:\d{2}/.test(s);
    const t = new Date(hasTime ? s : `${s.slice(0, 10)}T${String(COURSE_DEFAULT_HOUR_VN - 7).padStart(2, "0")}:00:00Z`);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  return null;
}

export interface TutorSignup { id: string; createdAt: Date }
export interface OwnedCourseRow { ownerId: string | null; createdAt: string }
export interface TaughtSessionRow { ownerId: string | null; date: Date }

/**
 * Giờ từ lúc đăng ký đến lúc tạo lớp đầu của gia sư (lớp do CHÍNH em tạo: ownerId). Lấy lớp sớm nhất.
 * • Lớp có NGÀY trước ngày đăng ký (dữ liệu lệch: chuyển chủ, nhập tay) → bỏ, không tính là "lớp đầu".
 * • Lớp cùng ngày đăng ký nhưng giờ (chữ 08:00) rơi trước lúc đăng ký → coi là 0 giờ, không để số âm.
 */
export function hoursToFirstClass(reg: Date, courseCreatedAts: string[]): number | null {
  let best: number | null = null;
  for (const raw of courseCreatedAts) {
    const t = parseCourseCreatedAt(raw);
    if (!t || vnKey(t) < vnKey(reg)) continue;
    const h = Math.max(0, (t.getTime() - reg.getTime()) / HOUR);
    if (best === null || h < best) best = h;
  }
  return best;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export interface MedianMetric { n: number; enough: boolean; hours: number | null }

export interface ActivationMetrics {
  /** Gia sư đăng ký trong khoảng đang xem (chưa lọc theo tuổi). */
  registered: number;
  /** (7) trong số gia sư đăng ký trong khoảng và đã đủ 24 giờ: bao nhiêu tạo lớp đầu trong 24 giờ. */
  classIn24h: Ratio;
  /** (8) trong số gia sư đã đủ 7 ngày: bao nhiêu có buổi đã dạy đầu trong 7 ngày. */
  taughtIn7d: Ratio;
  /** (9) trung vị giờ từ đăng ký đến lớp đầu, chỉ gia sư đã có lớp. */
  firstClassHours: MedianMetric;
  /** Khoảng đăng ký của từng lứa, để ghi lên màn. */
  cohort24: { from: Date; to: Date };
  cohort7: { from: Date; to: Date };
}
/**
 * `tutors`: gia sư thuộc tập đo (xem METRIC_DEFS). `courses` / `taught`: lớp và buổi đã dạy (ĐX-00) của họ; dòng của người
 * ngoài tập bị bỏ. Buổi đã dạy đếm khi `date` (00:00 UTC của ngày VN) nằm từ ngày VN của lúc đăng ký đến đúng 7×24 giờ sau đăng ký.
 */
export function activationMetrics(tutors: TutorSignup[], courses: OwnedCourseRow[], taught: TaughtSessionRow[], now: Date, days: number): ActivationMetrics {
  const from = now.getTime() - days * DAY;
  const inWin = tutors.filter(t => t.createdAt.getTime() >= from && t.createdAt.getTime() <= now.getTime());
  const byOwner = new Map<string, string[]>();
  for (const c of courses) if (c.ownerId) (byOwner.get(c.ownerId) ?? byOwner.set(c.ownerId, []).get(c.ownerId)!).push(c.createdAt);
  const taughtBy = new Map<string, Date[]>();
  for (const s of taught) if (s.ownerId) (taughtBy.get(s.ownerId) ?? taughtBy.set(s.ownerId, []).get(s.ownerId)!).push(s.date);

  const hours = (t: TutorSignup) => hoursToFirstClass(t.createdAt, byOwner.get(t.id) ?? []);
  const c24To = now.getTime() - ACTIVATION_CLASS_HOURS * HOUR, c7To = now.getTime() - ACTIVATION_TEACH_DAYS * DAY;
  const old24 = inWin.filter(t => t.createdAt.getTime() <= c24To);
  const old7 = inWin.filter(t => t.createdAt.getTime() <= c7To);
  const classIn24 = old24.filter(t => { const h = hours(t); return h !== null && h <= ACTIVATION_CLASS_HOURS; });
  const taughtIn7 = old7.filter(t => {
    const lo = new Date(`${vnKey(t.createdAt)}T00:00:00Z`).getTime(), hi = t.createdAt.getTime() + ACTIVATION_TEACH_DAYS * DAY;
    return (taughtBy.get(t.id) ?? []).some(d => d.getTime() >= lo && d.getTime() <= hi);
  });
  const hs = inWin.map(hours).filter((h): h is number => h !== null);
  return {
    registered: inWin.length,
    classIn24h: ratio(classIn24.length, old24.length),
    taughtIn7d: ratio(taughtIn7.length, old7.length),
    firstClassHours: { n: hs.length, enough: hs.length >= MIN_SAMPLE, hours: hs.length >= MIN_SAMPLE ? Math.round((median(hs) ?? 0) * 10) / 10 : null },
    cohort24: { from: new Date(from), to: new Date(c24To) },
    cohort7: { from: new Date(from), to: new Date(c7To) },
  };
}
/** "5,5 giờ" / "1 giờ"; dưới một giờ ghi phút. */
export function hoursText(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} phút`;
  return `${String(h).replace(".", ",")} giờ`;
}

// ─── Định nghĩa hiện trên màn ─────────────────────────────────────────────────────────────────────────────────
export type MetricKey = "zaloOpened" | "parentViewed" | "paidIn14" | "bank" | "timely" | "tutors" | "actClass" | "actTeach" | "actMedian";
export interface MetricDef { key: MetricKey; title: string; definition: string; denominator: string }
export const METRIC_ORDER: MetricKey[] = ["zaloOpened", "parentViewed", "paidIn14", "bank", "timely", "tutors"];
/** Nhóm thẻ "Gia sư mới vào" (NC2-020), vẽ riêng bên dưới sáu thẻ trên. */
export const ACTIVATION_ORDER: MetricKey[] = ["actClass", "actTeach", "actMedian"];
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
  actClass: {
    key: "actClass", title: "Tạo lớp đầu trong 24 giờ",
    definition: "Gia sư tạo lớp đầu tiên (lớp do chính em tạo) trong 24 giờ kể từ lúc đăng ký. Chỉ tính gia sư đã đăng ký đủ 24 giờ, để em mới vào hôm nay chưa bị tính là “bỏ”. Tính mọi gia sư đã đăng ký trừ người bị cấm hoặc bị khoá hồ sơ, kể cả em chưa được duyệt: đây là đo từ lúc đăng ký, và chỉ tính người đã duyệt thì bỏ sót đúng những em bỏ dở giữa chừng. Giờ của lớp lấy theo NGÀY ghi trên lớp (KiN chưa lưu giờ tạo lớp), nên sai số cỡ một ngày.",
    denominator: "gia sư đăng ký trong khoảng và đã đủ 24 giờ kể từ lúc đăng ký",
  },
  actTeach: {
    key: "actTeach", title: "Có buổi đã dạy trong 7 ngày",
    definition: "Gia sư có buổi điểm danh đầu tiên được tính là “buổi đã dạy” (ngày không ở tương lai, có em có mặt hoặc muộn — cùng định nghĩa ở hồ sơ công khai) trong 7 ngày kể từ lúc đăng ký. Chỉ tính gia sư đã đăng ký đủ 7 ngày, cùng tập gia sư với thẻ “Tạo lớp đầu”. Đây là điểm danh gia sư tự ghi trên KiN, không phải bằng chứng đã xác minh.",
    denominator: "gia sư đăng ký trong khoảng và đã đủ 7 ngày kể từ lúc đăng ký",
  },
  actMedian: {
    key: "actMedian", title: "Giờ từ đăng ký đến lớp đầu",
    definition: "Trung vị số giờ từ lúc đăng ký đến lúc tạo lớp đầu tiên, chỉ trong số gia sư đã có lớp. Gia sư chưa có lớp không nằm trong con số này (chúng hiện ở thẻ “Tạo lớp đầu”), nên số thật có thể cao hơn. Tính theo ngày ghi trên lớp nên sai số cỡ một ngày.",
    denominator: "gia sư đăng ký trong khoảng và đã có ít nhất một lớp",
  },
};
