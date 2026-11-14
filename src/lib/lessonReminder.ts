// DG-HOC-ONLINE (14/11/2026) — email nhắc học sinh TRƯỚC giờ học, gia sư chọn trước bao lâu. THUẦN (không Prisma, không đọc đồng hồ, không đọc env).
//
// Lịch gọi: cron-job.org gọi /api/cron/nhac-buoi-hoc mỗi 15 phút (gói Vercel thường chỉ cho cron hằng ngày — xem docs/kin/van-hanh/cron-nhac-buoi-hoc.md).
// Một buổi "tới hạn nhắc" khi thời điểm gửi = giờ bắt đầu − lead rơi vào cửa sổ (now − 20 phút, now] và buổi CHƯA bắt đầu.
// Cửa sổ 20 phút > nhịp gọi 15 phút nên một lượt trễ vài phút vẫn không bỏ sót; gửi trùng do hai lượt cùng thấy một buổi bị chặn ở bảng
// ClassLessonReminderLog (unique theo lớp × buổi × học sinh), không phải ở đây.
// Thư không có số tiền, không có tên gia sư (quy tắc thông báo của kho): chỉ tên lớp, ngày, giờ và link học.
import { addDaysKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

/** Các lựa chọn "Gửi email nhắc học sinh trước buổi học" (phút). Tắt = null. */
export const LEAD_OPTIONS = [15, 60, 1440] as const;
export type LeadMinutes = (typeof LEAD_OPTIONS)[number];
export const LEAD_LABEL: Record<LeadMinutes, string> = { 15: "15 phút", 60: "1 giờ", 1440: "1 ngày" };
/** Độ rộng cửa sổ (phút) tính lùi từ lúc cron chạy. Phải lớn hơn nhịp gọi 15 phút. */
export const WINDOW_MINUTES = 20;
/** Tối đa số thư mỗi lượt cron (Gmail có hạn mức ngày; phần còn lại đi ở lượt sau nếu vẫn trong cửa sổ). */
export const MAX_EMAILS_PER_RUN = 200;

export const isLeadMinutes = (v: unknown): v is LeadMinutes => typeof v === "number" && (LEAD_OPTIONS as readonly number[]).includes(v);

/** Giá trị form → lead. "" / "off" / "0" ⇒ tắt (null). Lạ ⇒ lỗi (không đoán). */
export function parseLeadMinutes(raw: unknown): { ok: true; value: LeadMinutes | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : null;
  if (s === null) return { ok: false };
  if (s === "" || s === "off" || s === "0") return { ok: true, value: null };
  if (!/^\d{1,4}$/.test(s)) return { ok: false };
  const n = Number(s);
  return isLeadMinutes(n) ? { ok: true, value: n } : { ok: false };
}

/** Lead đọc từ DB (có thể là số lạ do ai đó sửa tay) ⇒ chỉ nhận đúng ba lựa chọn, còn lại coi là tắt. */
export const leadOf = (v: number | null | undefined): LeadMinutes | null => (isLeadMinutes(v) ? v : null);

/** Link học online của lớp: bắt buộc https (http không được: thư gửi ra ngoài, link vào phòng học không nên đi qua kết nối không mã hoá). Rỗng ⇒ gỡ link. */
export function parseOnlineLink(raw: unknown): { ok: true; value: string | null; isMeet: boolean } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null, isMeet: false };
  if (typeof raw !== "string") return { ok: false, error: "Link không hợp lệ" };
  const v = raw.trim();
  if (v === "") return { ok: true, value: null, isMeet: false };
  if (v.length > 500) return { ok: false, error: "Link dài quá 500 ký tự" };
  let u: URL;
  try { u = new URL(v); } catch { return { ok: false, error: "Link phải là địa chỉ đầy đủ, bắt đầu bằng https://" }; }
  if (u.protocol !== "https:") return { ok: false, error: "Link phải bắt đầu bằng https://" };
  if (!u.hostname.includes(".") || u.username || u.password) return { ok: false, error: "Link không hợp lệ" };
  return { ok: true, value: v, isMeet: u.hostname === "meet.google.com" };
}

/** Buổi bắt đầu lúc `startAt` có tới hạn gửi nhắc ở thời điểm `now` không. Lead tắt ⇒ không bao giờ. */
export function isReminderDue(startAt: Date, lead: number | null | undefined, now: Date, windowMinutes: number = WINDOW_MINUTES): boolean {
  const l = leadOf(lead);
  if (l === null) return false;
  const start = startAt.getTime(), t = now.getTime();
  if (!Number.isFinite(start) || start <= t) return false; // buổi đã bắt đầu: nhắc lúc này là thừa
  const sendAt = start - l * 60_000;
  return sendAt <= t && sendAt > t - windowMinutes * 60_000;
}

/** Khoảng ngày VN cần dựng buổi để không bỏ sót buổi nào có thể tới hạn ở `now` (lead lớn nhất 1 ngày, kể cả qua nửa đêm). */
export function searchRangeKeys(now: Date): { fromKey: string; toKey: string } {
  const fromKey = vnDateKeyOf(now);
  // now + 1 ngày (lead lớn nhất) luôn rơi vào ngày VN kế tiếp; cộng thêm cửa sổ để buổi ngay sau nửa đêm hôm sau cũng nằm trong khoảng.
  const far = vnDateKeyOf(new Date(now.getTime() + (Math.max(...LEAD_OPTIONS) + WINDOW_MINUTES) * 60_000));
  return { fromKey, toKey: far > fromKey ? far : addDaysKey(fromKey, 1) };
}

/** Định danh buổi trong bảng chống gửi trùng. */
export const regularSessionKey = (scheduleId: string, originalDateKey: string) => `${scheduleId}:${originalDateKey}`;
export const extraSessionKey = (attendanceSessionId: string) => `extra:${attendanceSessionId}`;

const WEEKDAY = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export interface LessonReminderInput {
  courseName: string;
  startAt: Date;
  endAt: Date | null;
  /** Link học online hiệu lực (riêng buổi > khung giờ > chung lớp); null = không có / học trực tiếp. */
  joinUrl: string | null;
  /** Trang lớp trên KiN (đường dẫn tuyệt đối). */
  classUrl: string;
  leadMinutes: LeadMinutes;
}
/** Phần chữ của thư (đã tính sẵn) — HTML dựng ở src/lib/email.ts (lessonReminderHtml), nơi duy nhất được viết màu cứng cho thư. */
export interface LessonReminderMail {
  subject: string;
  text: string;
  view: { courseName: string; soon: string; when: string; joinUrl: string | null; classUrl: string };
}

/** P2-1 (14/11/2026): link vào học chỉ được chèn vào thư khi đúng https (link cũ trong DB có thể là http — lọt vào thư là lộ phiên học qua mạng không mã hoá).
 *  Không đạt / không phân tích được ⇒ null = coi như không có link (thư ghi NO_LINK_TEXT). Dùng cho cả cron nhac-buoi-hoc lẫn remind-class 07:00. */
export function httpsJoinUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return new URL(u.trim()).protocol === "https:" ? u.trim() : null; } catch { return null; }
}

/** Thư nhắc (tiêu đề + chữ thường + phần chữ cho HTML). Chỉ tên lớp, ngày, giờ, link: KHÔNG số tiền, không tên người. */
export function buildLessonReminderEmail(i: LessonReminderInput): LessonReminderMail {
  const dk = vnDateKeyOf(i.startAt);
  const [y, m, d] = dk.split("-");
  const wd = WEEKDAY[new Date(`${dk}T00:00:00Z`).getUTCDay()];
  const start = hmOf(vnMinutesOfDay(i.startAt));
  const end = i.endAt && i.endAt.getTime() > i.startAt.getTime() ? hmOf(vnMinutesOfDay(i.endAt)) : null;
  const when = `${wd}, ${d}/${m}/${y} lúc ${start}${end ? `–${end}` : ""}`;
  const soon = i.leadMinutes === 1440 ? "ngày mai" : `sau ${LEAD_LABEL[i.leadMinutes]} nữa`;
  const subject = `Sắp tới giờ học: ${i.courseName} (${start})`;
  const joinUrl = httpsJoinUrl(i.joinUrl);
  const linkLine = joinUrl ? `Link vào học: ${joinUrl}` : NO_LINK_TEXT;
  const text = [
    `Lớp "${i.courseName}" có buổi học ${soon}.`,
    `Thời gian: ${when} (giờ Việt Nam).`,
    linkLine,
    `Mở lớp trên KiN: ${i.classUrl}`,
    "",
    AUTO_NOTE,
  ].join("\n");
  return { subject, text, view: { courseName: i.courseName, soon, when, joinUrl, classUrl: i.classUrl } };
}
export const NO_LINK_TEXT = "Buổi này chưa có link học online. Xem chi tiết trong lớp trên KiN.";
export const AUTO_NOTE = "Thư này gửi tự động vì gia sư của lớp đã bật nhắc trước giờ học.";

/** Kiểm "không có số tiền" cho thư / thông báo: không có "đ", "₫", "VND", "đồng" đi sau con số. Dùng trong test và làm chốt chặn trước khi gửi. */
export function looksLikeMoney(s: string): boolean {
  return /\d[\d.,\s]*(₫|(đ|vnd|vnđ|đồng|nghìn|triệu)(?!\p{L}))/iu.test(s);
}
