// TT-201/202 — quy tắc buổi học, báo nghỉ sát giờ, buổi bù và nhắc lịch. THUẦN (không
// Prisma, không đọc đồng hồ ngầm) để test được từng ca biên. Đặc tả:
// docs/kin/nghiep-vu/lich-nhac-va-che-do-gon.md.
//
// Buổi học không có bản ghi riêng: ClassSchedule là quy luật lặp hàng tuần, nên 1 buổi
// = (scheduleId, dateKey) với dateKey "YYYY-MM-DD" theo giờ Việt Nam (UTC+7 quanh năm).

const VN_OFFSET_MS = 7 * 3600_000;
const MIN_MS = 60_000;
const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

// ── Tham số (docs/kin/nghiep-vu/lich-nhac-va-che-do-gon.md, mục "Tham số") ─────────
export const ABSENCE_NOTICE_MINUTES = 120;   // NGƯỠNG_SÁT_GIỜ — đã chốt 30/09
export const MAKEUP_VALID_DAYS = 30;         // HẠN_BUỔI_BÙ — đã chốt 30/09
export const MAKEUP_WARN_DAYS = 3;           // BÁO_TRƯỚC_HẾT_HẠN_BÙ — đề xuất
export const QUIET_START_MIN = 22 * 60;      // GIỜ_YÊN_LẶNG 22:00 — đã chốt 30/09
export const QUIET_END_MIN = 7 * 60;         //                 07:00
export const REMINDER_SHIFT_MIN = 21 * 60 + 30; // DỜI_TIN_24_GIỜ_VỀ 21:30 — đề xuất
export const SKIP_H1_BEFORE_MIN = 8 * 60;    // BỎ_TIN_1_GIỜ_NẾU_BUỔI_TRƯỚC 08:00 — đề xuất

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_VI = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

// ── Thời gian theo giờ VN ───────────────────────────────────────────────────────

/** "19:00" → 1140 phút kể từ 00:00; sai định dạng → null. */
export function parseHm(s: string | null | undefined): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((s ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function hmOf(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function dateParts(dateKey: string): { y: number; mo: number; d: number } | null {
  const m = DATE_KEY_RE.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const chk = new Date(Date.UTC(y, mo - 1, d));
  // Chặn ngày không tồn tại (31/02 tràn sang tháng sau).
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  return { y, mo, d };
}

export function isValidDateKey(dateKey: string): boolean { return dateParts(dateKey) !== null; }

/** Ngày VN của một thời điểm. */
export function vnDateKeyOf(t: Date): string {
  return new Date(t.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Số phút kể từ 00:00 giờ VN của thời điểm đó. */
export function vnMinutesOfDay(t: Date): number {
  const v = new Date(t.getTime() + VN_OFFSET_MS);
  return v.getUTCHours() * 60 + v.getUTCMinutes();
}

export function addDaysKey(dateKey: string, n: number): string {
  const p = dateParts(dateKey);
  if (!p) throw new Error(`dateKey không hợp lệ: ${dateKey}`);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Thứ của dateKey: 0 = CN … 6 = T7 (khớp ClassSchedule.dayOfWeek). */
export function dayOfWeekOfKey(dateKey: string): number {
  const p = dateParts(dateKey);
  if (!p) throw new Error(`dateKey không hợp lệ: ${dateKey}`);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay();
}

/** Thời điểm (UTC) tương ứng "dateKey lúc minutes phút" theo giờ VN. */
export function instantOf(dateKey: string, minutes: number): Date {
  const p = dateParts(dateKey);
  if (!p) throw new Error(`dateKey không hợp lệ: ${dateKey}`);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d) + minutes * MIN_MS - VN_OFFSET_MS);
}

/** Tuần chứa dateKey, tính từ Thứ Hai đến Chủ nhật. */
export function weekRangeOf(dateKey: string): { from: string; to: string } {
  const dow = dayOfWeekOfKey(dateKey);
  const fromKey = addDaysKey(dateKey, -((dow + 6) % 7));
  return { from: fromKey, to: addDaysKey(fromKey, 6) };
}

// ── Khai triển lịch tuần thành các buổi cụ thể ──────────────────────────────────

export interface ScheduleRule {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active?: boolean;
}
export interface Occurrence {
  scheduleId: string;
  courseId: string;
  dateKey: string;
  startAt: Date;
  endAt: Date;
}
export const MAX_WINDOW_DAYS = 62;

/** Các buổi rơi trong [fromKey, toKey] (gồm cả hai đầu), sắp theo giờ bắt đầu. */
export function expandOccurrences(rules: ScheduleRule[], fromKey: string, toKey: string): Occurrence[] {
  const days: string[] = [];
  for (let k = fromKey, i = 0; k <= toKey; k = addDaysKey(k, 1), i++) {
    if (i >= MAX_WINDOW_DAYS) throw new Error(`Khoảng ngày quá dài (tối đa ${MAX_WINDOW_DAYS} ngày)`);
    days.push(k);
  }
  const out: Occurrence[] = [];
  for (const r of rules) {
    if (r.active === false) continue;
    const s = parseHm(r.startTime);
    if (s === null) continue; // khung giờ nhập sai định dạng: bỏ qua, không làm hỏng cả lịch
    const e = parseHm(r.endTime);
    for (const dk of days) {
      if (dayOfWeekOfKey(dk) !== r.dayOfWeek) continue;
      out.push({
        scheduleId: r.id, courseId: r.courseId, dateKey: dk,
        startAt: instantOf(dk, s),
        endAt: instantOf(dk, e !== null && e > s ? e : s),
      });
    }
  }
  return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.scheduleId.localeCompare(b.scheduleId));
}

// ── TT-202: báo nghỉ ────────────────────────────────────────────────────────────

export type AbsenceReportKind = "auto" | "late" | "started";
export interface AbsenceClassification { kind: AbsenceReportKind; leadMinutes: number }

/**
 * Báo trước ≥ 2 giờ → "auto" (tự ghi Nghỉ có báo + giữ buổi bù). Dưới 2 giờ → "late"
 * (chờ gia sư bấm 1 nút). Đã tới/qua giờ bắt đầu → "started" (không nhận báo nghỉ nữa).
 */
export function classifyAbsenceReport(startAt: Date, reportedAt: Date): AbsenceClassification {
  const leadMs = startAt.getTime() - reportedAt.getTime();
  const leadMinutes = Math.floor(leadMs / MIN_MS);
  if (leadMs <= 0) return { kind: "started", leadMinutes: Math.min(0, leadMinutes) };
  return { kind: leadMinutes >= ABSENCE_NOTICE_MINUTES ? "auto" : "late", leadMinutes };
}

/** Hạn báo nghỉ để còn được giữ buổi bù: giờ học trừ 2 giờ. */
export function absenceDeadline(startAt: Date): Date {
  return new Date(startAt.getTime() - ABSENCE_NOTICE_MINUTES * MIN_MS);
}

// ── TT-202: buổi bù ─────────────────────────────────────────────────────────────

export function makeupExpiry(grantedAt: Date): Date {
  return new Date(grantedAt.getTime() + MAKEUP_VALID_DAYS * DAY_MS);
}
export function isMakeupExpired(c: { expiresAt: Date }, now: Date): boolean {
  return c.expiresAt.getTime() <= now.getTime();
}
/** Còn dùng được nhưng sắp hết hạn trong MAKEUP_WARN_DAYS ngày tới → báo gia sư. */
export function isMakeupExpiringSoon(c: { expiresAt: Date }, now: Date): boolean {
  const left = c.expiresAt.getTime() - now.getTime();
  return left > 0 && left <= MAKEUP_WARN_DAYS * DAY_MS;
}

// ── TT-201: lịch nhắc ───────────────────────────────────────────────────────────

export interface ReminderPlan {
  /** Tin nhắc 24 giờ — luôn có; dời về 21:30 nếu rơi vào giờ yên lặng. */
  h24: { dueAt: Date; shifted: boolean };
  /** Tin nhắc 1 giờ — null nếu bị bỏ (buổi trước 08:00 hoặc rơi vào giờ yên lặng). */
  h1: { dueAt: Date } | null;
  h1SkipReason: "sang-som" | "gio-yen-lang" | null;
  absenceDeadline: Date;
}

export function inQuietHours(minutesOfDay: number): boolean {
  return minutesOfDay >= QUIET_START_MIN || minutesOfDay < QUIET_END_MIN;
}

export function reminderPlan(startAt: Date): ReminderPlan {
  const h24Raw = new Date(startAt.getTime() - 24 * HOUR_MS);
  const localMin = vnMinutesOfDay(h24Raw);
  let h24Due = h24Raw;
  let shifted = false;
  if (inQuietHours(localMin)) {
    // Dời về 21:30 gần nhất TRƯỚC thời điểm gốc: từ 22:00 tối thì 21:30 cùng ngày,
    // từ 00:00–07:00 thì 21:30 tối hôm trước.
    const dayKey = vnDateKeyOf(h24Raw);
    h24Due = instantOf(localMin >= QUIET_START_MIN ? dayKey : addDaysKey(dayKey, -1), REMINDER_SHIFT_MIN);
    shifted = true;
  }

  const h1Raw = new Date(startAt.getTime() - HOUR_MS);
  let h1: ReminderPlan["h1"] = { dueAt: h1Raw };
  let h1SkipReason: ReminderPlan["h1SkipReason"] = null;
  if (vnMinutesOfDay(startAt) < SKIP_H1_BEFORE_MIN) { h1 = null; h1SkipReason = "sang-som"; }
  else if (inQuietHours(vnMinutesOfDay(h1Raw))) { h1 = null; h1SkipReason = "gio-yen-lang"; }

  return { h24: { dueAt: h24Due, shifted }, h1, h1SkipReason, absenceDeadline: absenceDeadline(startAt) };
}

export type ReminderKind = "h24" | "h1";
export type ReminderRecipient = "parent" | "student";

/** Các tin nhắc đã tới hạn gửi tại `now` và buổi chưa bắt đầu (hết giờ thì thôi, không nhắc muộn). */
export function dueReminderKinds(startAt: Date, now: Date): ReminderKind[] {
  if (now.getTime() >= startAt.getTime()) return [];
  const plan = reminderPlan(startAt);
  const out: ReminderKind[] = [];
  if (now.getTime() >= plan.h24.dueAt.getTime()) out.push("h24");
  if (plan.h1 && now.getTime() >= plan.h1.dueAt.getTime()) out.push("h1");
  return out;
}

const partOfDay = (min: number) => (min < 12 * 60 ? "sáng" : min < 18 * 60 ? "chiều" : "tối");
const ddmm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

export interface ReminderMessageInput {
  kind: ReminderKind;
  recipient: ReminderRecipient;
  studentName: string;
  subject: string;
  startAt: Date;
  /** Tên gia sư (đã gồm cách xưng nếu có); trống thì bỏ cụm "với …". */
  tutorName?: string | null;
  joinUrl?: string | null;
  /** Thời điểm soạn tin — để viết "tối mai"/"hôm nay". */
  now: Date;
}

/** Tin nhắc soạn sẵn theo mẫu của đặc tả. Gia sư vẫn sửa được trước khi gửi. */
export function buildReminderMessage(i: ReminderMessageInput): string {
  const startKey = vnDateKeyOf(i.startAt);
  const startMin = vnMinutesOfDay(i.startAt);
  const hm = hmOf(startMin);
  const gap = Math.round((Date.parse(`${startKey}T00:00:00Z`) - Date.parse(`${vnDateKeyOf(i.now)}T00:00:00Z`)) / DAY_MS);
  const dayWord = gap === 1 ? " mai" : gap === 0 ? " hôm nay" : "";
  const wd = WEEKDAY_VI[dayOfWeekOfKey(startKey)];
  const weekday = wd.charAt(0).toLowerCase() + wd.slice(1); // "thứ Năm" như mẫu tin trong đặc tả
  const link = i.joinUrl ? `\nLink vào lớp: ${i.joinUrl}` : "";
  const parent = i.recipient === "parent";
  const who = parent ? `con ${i.studentName}` : "bạn";

  if (i.kind === "h1") {
    return parent
      ? `Còn 1 giờ nữa là buổi ${i.subject} của ${i.studentName} (${hm}).${link}`
      : `Còn 1 giờ nữa là buổi ${i.subject} của bạn (${hm}).${link}`;
  }

  const deadline = absenceDeadline(i.startAt);
  const dlKey = vnDateKeyOf(deadline);
  const dlText = `${hmOf(vnMinutesOfDay(deadline))}${dlKey === startKey ? "" : ` ngày ${ddmm(dlKey)}`}`;
  const withTutor = i.tutorName?.trim() ? `, với ${i.tutorName.trim()}` : "";
  const head = `KiN nhắc lịch: ${who} có buổi ${i.subject} lúc ${hm} ${partOfDay(startMin)}${dayWord}, ${weekday} ${ddmm(startKey)}${withTutor}.`;
  const tail = parent
    ? `Con cần nghỉ thì anh/chị báo ở sổ học trước ${dlText} để con được giữ buổi bù.`
    : `Cần nghỉ thì bạn báo thầy/cô trước ${dlText} để được giữ buổi bù.`;
  return `${head}${link}\n${tail}`;
}

/** Tin nhắc lịch CHUNG cho nhóm Zalo lớp (PH-216): không tên em, không hạn báo nghỉ riêng từng em. */
export function buildGroupReminderMessage(i: { subject: string; startAt: Date; joinUrl?: string | null; now: Date }): string {
  const startKey = vnDateKeyOf(i.startAt);
  const startMin = vnMinutesOfDay(i.startAt);
  const gap = Math.round((Date.parse(`${startKey}T00:00:00Z`) - Date.parse(`${vnDateKeyOf(i.now)}T00:00:00Z`)) / DAY_MS);
  const dayWord = gap === 1 ? " mai" : gap === 0 ? " hôm nay" : "";
  const wd = WEEKDAY_VI[dayOfWeekOfKey(startKey)];
  const weekday = wd.charAt(0).toLowerCase() + wd.slice(1);
  const link = i.joinUrl ? `\nLink vào lớp: ${i.joinUrl}` : "";
  return `KiN nhắc lịch: cả lớp có buổi ${i.subject} lúc ${hmOf(startMin)} ${partOfDay(startMin)}${dayWord}, ${weekday} ${ddmm(startKey)}.${link}\nCần nghỉ thì báo riêng với thầy/cô trước giờ học nhé.`;
}

/** "Thanh" → "Thầy/Cô Thanh"; tên đã có "Thầy"/"Cô" ở đầu thì giữ nguyên. Trống → null. */
export function tutorTitle(name: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  return /^(thầy|cô|thay|co)(\s|$)/i.test(n) ? n : `Thầy/Cô ${n}`;
}

/** Tin gửi phụ huynh sau khi gia sư bấm "Không tính phí, giữ 1 buổi bù". */
export function buildAbsenceFreeMessage(i: { dateKey: string; makeupCount: number; tutorName?: string | null }): string {
  const who = i.tutorName?.trim() || "Thầy/Cô";
  return `Đã ghi nhận con nghỉ buổi ${ddmm(i.dateKey)}. Buổi này không tính phí và con còn ${Math.max(1, i.makeupCount)} buổi bù. ${who} sẽ hẹn giờ bù với anh/chị.`;
}

/** Tin gợi ý khi gia sư chọn "Tính phí buổi này" (đặc tả không có mẫu riêng — để gia sư sửa). */
export function buildAbsenceChargedMessage(i: { dateKey: string }): string {
  return `Đã ghi nhận con nghỉ buổi ${ddmm(i.dateKey)}. Vì báo sát giờ nên buổi này vẫn tính phí theo quy định đã báo trước, và không có buổi bù.`;
}

/** Mô tả báo trước bao lâu, vd "báo trước 45 phút". */
export function describeLead(leadMinutes: number): string {
  if (leadMinutes < 60) return `báo trước ${Math.max(0, leadMinutes)} phút`;
  const h = Math.floor(leadMinutes / 60), m = leadMinutes % 60;
  return m === 0 ? `báo trước ${h} giờ` : `báo trước ${h} giờ ${m} phút`;
}

/** Link vào lớp (Meet/Zoom): trống → null; có thì phải là http(s) hợp lệ, tối đa 500 ký tự. */
export function normalizeJoinUrl(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const v = raw.trim();
  if (v === "") return { ok: true, value: null };
  if (v.length > 500) return { ok: false };
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false };
  } catch { return { ok: false }; }
  return { ok: true, value: v };
}

/** "9:05" → "09:05" (để so sánh chuỗi giờ đúng); sai định dạng → null. */
export function normalizeHm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = parseHm(raw);
  return m === null ? null : hmOf(m);
}
