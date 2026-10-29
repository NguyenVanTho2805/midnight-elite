// Lịch RIÊNG của học sinh (NC2-043, góp ý 28/10: "thêm chức năng sửa lịch cho học sinh, ngoài lịch cố định của các lớp").
// THUẦN: không DB, không React, không giờ hệ thống (ngày hôm nay truyền vào). Test: tools/local-e2e/t-personal-events-lib.ts.
//
// Việc riêng = thứ chính học sinh gõ cho CHÍNH mình (học thêm ngoài KiN, tự ôn…). Chỉ chủ tài khoản đọc / sửa / xoá; không hiện cho gia sư, phụ huynh hay quản trị,
// không gửi cho AI, không đụng lịch lớp. Giờ theo giờ Việt Nam: ngày "YYYY-MM-DD", giờ "HH:mm".
import { addDaysKey, isValidDateKey, parseHm, hmOf } from "@/lib/classSessions";

export const PERSONAL_TITLE_MAX = 80;
export const PERSONAL_NOTE_MAX = 300;
/** Tối đa mỗi tài khoản (chống nhồi dữ liệu). */
export const PERSONAL_MAX_PER_USER = 300;
/** Không cho ghi quá xa: lùi tối đa 1 năm, tiến tối đa 2 năm so với hôm nay. */
export const PERSONAL_PAST_DAYS = 366;
export const PERSONAL_FUTURE_DAYS = 731;
/** Một lần đọc tối đa bấy nhiêu ngày (tuần = 7; tháng = 31). */
export const PERSONAL_RANGE_MAX_DAYS = 62;

export interface PersonalEventValue { title: string; dateKey: string; startTime: string; endTime: string | null; note: string | null }
export type PersonalCheck = { ok: true; value: PersonalEventValue } | { ok: false; error: string };

/** Bỏ ký tự điều khiển, gộp khoảng trắng (đổi dòng thành dấu cách với tên; giữ đổi dòng với ghi chú). */
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
const multiLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim() : "");

/**
 * Kiểm một việc riêng từ dữ liệu thô (JSON do trình duyệt gửi, KHÔNG tin). `todayKey` = ngày hôm nay giờ VN.
 * Trả lỗi bằng tiếng Việt, nói rõ ô nào sai; giờ kết thúc (nếu có) phải sau giờ bắt đầu trong cùng ngày.
 */
export function cleanPersonalEvent(raw: unknown, todayKey: string): PersonalCheck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Dữ liệu không đúng dạng." };
  const o = raw as Record<string, unknown>;
  const title = oneLine(o.title);
  if (!title) return { ok: false, error: "Chưa đặt tên cho việc riêng." };
  if (title.length > PERSONAL_TITLE_MAX) return { ok: false, error: `Tên tối đa ${PERSONAL_TITLE_MAX} ký tự.` };

  const dateKey = typeof o.dateKey === "string" ? o.dateKey.trim() : "";
  if (!dateKey || !isValidDateKey(dateKey)) return { ok: false, error: "Ngày chưa đúng." };
  if (dateKey < addDaysKey(todayKey, -PERSONAL_PAST_DAYS)) return { ok: false, error: "Ngày quá xa trong quá khứ (chỉ nhận trong vòng 1 năm trở lại)." };
  if (dateKey > addDaysKey(todayKey, PERSONAL_FUTURE_DAYS)) return { ok: false, error: "Ngày quá xa trong tương lai (chỉ nhận trong vòng 2 năm tới)." };

  const startMin = parseHm(typeof o.startTime === "string" ? o.startTime : "");
  if (startMin === null) return { ok: false, error: "Giờ bắt đầu chưa đúng (dạng 19:30)." };
  let endTime: string | null = null;
  if (o.endTime !== undefined && o.endTime !== null && o.endTime !== "") {
    const endMin = parseHm(typeof o.endTime === "string" ? o.endTime : "");
    if (endMin === null) return { ok: false, error: "Giờ kết thúc chưa đúng (dạng 21:00)." };
    if (endMin <= startMin) return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu (trong cùng một ngày)." };
    endTime = hmOf(endMin);
  }

  const noteRaw = o.note === undefined || o.note === null ? "" : multiLine(o.note);
  if (noteRaw.length > PERSONAL_NOTE_MAX) return { ok: false, error: `Ghi chú tối đa ${PERSONAL_NOTE_MAX} ký tự.` };
  return { ok: true, value: { title, dateKey, startTime: hmOf(startMin), endTime, note: noteRaw || null } };
}

/** Khoảng ngày khi đọc danh sách: cả hai đầu hợp lệ, from ≤ to, tối đa PERSONAL_RANGE_MAX_DAYS ngày. */
export function cleanPersonalRange(from: unknown, to: unknown): { ok: true; from: string; to: string } | { ok: false; error: string } {
  const f = typeof from === "string" ? from.trim() : "", t = typeof to === "string" ? to.trim() : "";
  if (!f || !t || !isValidDateKey(f) || !isValidDateKey(t)) return { ok: false, error: "Khoảng ngày chưa đúng." };
  if (f > t) return { ok: false, error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." };
  if (addDaysKey(f, PERSONAL_RANGE_MAX_DAYS - 1) < t) return { ok: false, error: `Chỉ đọc tối đa ${PERSONAL_RANGE_MAX_DAYS} ngày một lần.` };
  return { ok: true, from: f, to: t };
}

/** Dòng trả cho trình duyệt. */
export interface PersonalEventDTO { id: string; title: string; dateKey: string; startTime: string; endTime: string | null; note: string | null }
