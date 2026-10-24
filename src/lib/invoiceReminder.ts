// F2 — Vòng thu học phí: hạn đóng, nhắc nhiều bước, lịch sử nhắc. PHẦN THUẦN (không DB, không React) để test.
// Nguồn: docs/kin/rd/pro/tinh-nang-pro-tra-phi.md mục 9-F2 và 10.
//
// Nguyên tắc cứng:
//  • Bước 1 (tin soạn sẵn, mở Zalo, "Đã mở Zalo lúc …") MIỄN PHÍ và nằm ở invoiceZalo.ts; file này chỉ thêm bước 2–3 (Pro).
//  • KiN không bao giờ ghi "đã gửi": chỉ biết gia sư BẤM MỞ Zalo. Gia sư tự bấm gửi trong Zalo.
//  • Tin leo thang NHẸ NHÀNG: không doạ, không hứa (không hẹn giảm, chia nhỏ, gia hạn), không nêu hậu quả.
//  • Hạn đóng chỉ để trình bày và nhắc. Không đổi số tiền, không đổi trạng thái phiếu, không tự cộng phí, không tự gạch nợ.
import { isValidDateKey, vnDateKeyOf } from "@/lib/classSessions";

/** Mã lỗi khi gia sư Free (cổng bật) gọi bước 2–3. */
export const PRO_REQUIRED_CODE = "PRO_REQUIRED";

/** Bước nhắc: 1 = miễn phí (đã có); 2–3 = KiN Pro. */
export type ReminderStep = 1 | 2 | 3;
export const REMINDER_STEPS: readonly ReminderStep[] = [1, 2, 3];
export const isReminderStep = (v: unknown): v is ReminderStep => v === 1 || v === 2 || v === 3;

/** Cách nhau tối thiểu giữa hai bước để KiN gợi "đã đến lúc nhắc bước kế" (ngày, theo ngày VN). */
export const REMINDER_GAP_DAYS = 3;
/** Ngày mặc định của "hạn trước ngày N" khi chưa có cấu hình (khoá SettingKV: DEFAULT_DUE_DAY_KEY). */
export const DEFAULT_DUE_DAY = 20;
export const DEFAULT_DUE_DAY_KEY = "invoice.defaultDueDay";

/** Trạng thái phiếu còn đang đi đòi: đã gửi hoặc đóng một phần. Phụ huynh đã báo chuyển thì KHÔNG nhắc thêm (chờ gia sư kiểm sao kê). */
export const REMINDABLE_STATUSES = ["sent", "partial"] as const;

const DAY_MS = 24 * 3600_000;
/** Số ngày giữa hai ngày VN (b − a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Hạn đóng hợp lệ: "YYYY-MM-DD" thật, trong khoảng [hôm nay − 400 ngày, hôm nay + 800 ngày] (chặn gõ nhầm năm). */
export function validateDueDate(v: unknown, now: Date): { ok: true; dueDate: string } | { ok: false; error: string } {
  if (typeof v !== "string" || !isValidDateKey(v)) return { ok: false, error: "Hạn đóng phải là ngày hợp lệ dạng YYYY-MM-DD" };
  const today = vnDateKeyOf(now);
  const d = daysBetweenKeys(today, v);
  if (d < -400 || d > 800) return { ok: false, error: "Hạn đóng lệch quá xa hôm nay, hãy kiểm lại năm" };
  return { ok: true, dueDate: v };
}

/** Số ngày quá hạn (>0) tính đến hết ngày hạn; 0 = chưa quá hạn hoặc chưa có hạn. Hạn là ngày cuối được đóng: hôm đó chưa tính quá hạn. */
export function daysOverdue(dueDate: string | null | undefined, now: Date): number {
  if (!dueDate || !isValidDateKey(dueDate)) return 0;
  return Math.max(0, daysBetweenKeys(dueDate, vnDateKeyOf(now)));
}

/** Gợi ý hạn đóng: ngày `day` gần nhất tính từ hôm nay (kể cả hôm nay). Ngày 29–31 bị kẹp về cuối tháng nếu tháng ngắn. */
export function defaultDueDateKey(now: Date, day: number = DEFAULT_DUE_DAY): string {
  const d = Math.min(28, Math.max(1, Math.round(day)));
  const today = vnDateKeyOf(now);
  const [y, m] = today.split("-").map(Number);
  const thisMonth = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (thisMonth >= today) return thisMonth;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const dueDateLabel = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

/** Cụm "hạn …" dùng trong tin: có hạn thật → "hạn đóng 20/11/2026"; chưa có → GIỮ NGUYÊN chữ cũ "hạn trước ngày 20". */
export function dueClause(dueDate: string | null | undefined): string {
  return dueDate && isValidDateKey(dueDate) ? `hạn đóng ${dueDateLabel(dueDate)}` : "hạn trước ngày 20";
}

// ─── Khi nào "đến lúc nhắc bước kế" ─────────────────────────────────────────────────────────────────────────────────
export interface ReminderLogRow { step: number; openedAt: Date }
export interface DueInput {
  status: string;
  amountDue: number;
  paidAmount: number;
  dueDate: string | null;
  /** Bước 1 cũ (trước khi có bảng lịch sử) chỉ có zaloOpenedAt. */
  zaloOpenedAt: Date | null;
  reminders: ReminderLogRow[];
}
export interface DueResult {
  /** Bước nên nhắc tiếp, hoặc null nếu chưa tới lúc / không nhắc được. */
  step: 2 | 3 | null;
  /** Số ngày quá hạn (0 nếu chưa có hạn hoặc chưa quá). */
  overdueDays: number;
  /** Số ngày kể từ lần mở Zalo gần nhất (null nếu chưa nhắc lần nào). */
  sinceDays: number | null;
  lastStep: number;
}

/** Thời điểm mở Zalo gần nhất của bước `step` (đã gồm bước 1 cũ chỉ có zaloOpenedAt). */
export function lastOpenedAt(inv: Pick<DueInput, "zaloOpenedAt" | "reminders">, step: number): Date | null {
  const times = inv.reminders.filter(r => r.step === step).map(r => r.openedAt.getTime());
  if (step === 1 && inv.zaloOpenedAt) times.push(inv.zaloOpenedAt.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

/**
 * Tính "đến lúc nhắc bước 2/3" khi MỞ TRANG (không cần cron theo giờ):
 *  • Chỉ phiếu đã gửi / đóng một phần còn nợ; phụ huynh đã báo chuyển, nháp, đã đóng, đã huỷ thì không.
 *  • Bước 2: đã mở Zalo bước 1 từ ≥ REMINDER_GAP_DAYS ngày và chưa có bước 2.
 *  • Bước 3: đã có bước 2 từ ≥ REMINDER_GAP_DAYS ngày và chưa có bước 3.
 *  • Không có bước 4: sau bước 3 KiN không gợi thêm.
 */
export function reminderDue(inv: DueInput, now: Date): DueResult {
  const today = vnDateKeyOf(now);
  const s1 = lastOpenedAt(inv, 1), s2 = lastOpenedAt(inv, 2), s3 = lastOpenedAt(inv, 3);
  const last = s3 ?? s2 ?? s1;
  const lastStep = s3 ? 3 : s2 ? 2 : s1 ? 1 : 0;
  const sinceDays = last ? daysBetweenKeys(vnDateKeyOf(last), today) : null;
  const overdueDays = daysOverdue(inv.dueDate, now);
  const open = (REMINDABLE_STATUSES as readonly string[]).includes(inv.status) && inv.amountDue - inv.paidAmount > 0;
  let step: 2 | 3 | null = null;
  if (open && !s3) {
    if (s2) { if (sinceDays !== null && sinceDays >= REMINDER_GAP_DAYS) step = 3; }
    else if (s1 && sinceDays !== null && sinceDays >= REMINDER_GAP_DAYS) step = 2;
  }
  return { step, overdueDays, sinceDays, lastStep };
}

/** Cho phép gửi bước `step` không: bước 2 cần đã có bước 1; bước 3 cần đã có bước 2. */
export function stepAllowed(step: ReminderStep, inv: Pick<DueInput, "zaloOpenedAt" | "reminders">): boolean {
  if (step === 1) return true;
  return lastOpenedAt(inv, step - 1) !== null;
}

// ─── Tin nhắn ───────────────────────────────────────────────────────────────────────────────────────────────────────
const monthNumber = (ym: string) => Number(ym.split("-")[1]);
const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

/**
 * Tin CHAT RIÊNG bước 2 và 3. Gia sư sửa được trước khi tự bấm gửi.
 * Không doạ, không hứa, không nêu hậu quả; luôn chừa lối cho trường hợp phụ huynh đã chuyển.
 */
export function reminderMessage(step: 2 | 3, o: { studentName: string; yearMonth: string; amount: number; url: string; dueDate?: string | null }): string {
  const m = monthNumber(o.yearMonth);
  if (step === 2) {
    return `Dạ em nhắc nhẹ anh/chị về phiếu học phí tháng ${m} của con ${o.studentName}, còn ${money(o.amount)} (${dueClause(o.dueDate)}). ` +
      `Nếu anh/chị đã chuyển rồi thì mong anh/chị bỏ qua tin này, và bấm “Tôi đã chuyển” trên phiếu giúp em nhé: ${o.url}`;
  }
  return `Dạ em xin gửi lại phiếu học phí tháng ${m} của con ${o.studentName}, còn ${money(o.amount)} (${dueClause(o.dueDate)}), phòng khi tin trước bị trôi. ` +
    `Nếu anh/chị cần em xem lại số tiền hay có điều gì chưa rõ, anh/chị nhắn em giúp nhé. Phiếu và mã chuyển khoản ở đây: ${o.url}`;
}

// ─── Lịch sử nhắc (dựng từ dữ liệu có thật) ─────────────────────────────────────────────────────────────────────────
export type HistoryKind = "zalo_opened" | "parent_reported" | "matched";
export interface HistoryEvent { kind: HistoryKind; at: string; step?: number; amount?: number }
export const HISTORY_LABEL: Record<HistoryKind, string> = {
  zalo_opened: "Đã mở Zalo",
  parent_reported: "Phụ huynh bấm “Tôi đã chuyển”",
  matched: "Đã có tiền ghi vào phiếu",
};

/**
 * Gộp các nguồn thành một dòng thời gian, cũ → mới.
 * Phiếu CŨ (trước khi có bảng lịch sử) chỉ có `zaloOpenedAt` → coi là một lần bước 1, nhưng CHỈ khi bảng lịch sử còn trống:
 * `zaloOpenedAt` luôn bằng lần mở Zalo GẦN NHẤT, nên nếu đã có dòng bước 2–3 thì nó là giờ của bước đó, không phải của bước 1.
 */
export function buildHistory(o: {
  reminders: ReminderLogRow[]; zaloOpenedAt: Date | null; parentReportedAt: Date | null;
  payments: Array<{ at: Date; amount: number }>;
}): HistoryEvent[] {
  const ev: HistoryEvent[] = o.reminders.map(r => ({ kind: "zalo_opened" as const, at: r.openedAt.toISOString(), step: r.step }));
  if (o.zaloOpenedAt && o.reminders.length === 0) ev.push({ kind: "zalo_opened", at: o.zaloOpenedAt.toISOString(), step: 1 });
  if (o.parentReportedAt) ev.push({ kind: "parent_reported", at: o.parentReportedAt.toISOString() });
  for (const p of o.payments) ev.push({ kind: "matched", at: p.at.toISOString(), amount: p.amount });
  return ev.sort((a, b) => a.at.localeCompare(b.at));
}
