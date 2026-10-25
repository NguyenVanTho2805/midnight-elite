// KH-04 / PH-07 — "Yêu cầu tìm gia sư" của khách (phụ huynh hoặc người học từ 16 tuổi), gửi tới MỘT gia sư đang công khai. Hàm THUẦN.
// Test: tools/local-e2e/t-tutor-request-lib.ts. CHƯA có ý kiến luật sư (Q-LS-09..12 trong docs/kin/bao-cao/cau-hoi-luat-su.md).
//
// Chỉ thu TỐI THIỂU: cấp học, môn, hình thức, khung giờ, ghi chú ngắn, tên (không bắt buộc) và số Zalo của PHỤ HUYNH. KHÔNG thu tên, ngày sinh, trường của trẻ.
// Hộp đồng ý KHÔNG tích sẵn; KiN không xác minh người bấm là ai. Chống spam: ô bẫy, thời gian điền tối thiểu, giới hạn theo IP và theo số điện thoại.
import { cleanText } from "@/lib/tutorArea";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { TEACHING_MODES, type TeachingMode } from "@/lib/tutorArea";

export const REQUEST_LEVELS = ["tieu-hoc", "thcs", "thpt", "khac"] as const;
export type RequestLevel = (typeof REQUEST_LEVELS)[number];
export const LEVEL_LABEL: Record<RequestLevel, string> = { "tieu-hoc": "Tiểu học", thcs: "THCS (lớp 6 đến 9)", thpt: "THPT (lớp 10 đến 12)", khac: "Khác (đại học, người đi làm…)" };

export const REQUEST_STATUSES = ["new", "accepted", "declined", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** Chữ cho PHỤ HUYNH theo dõi (giọng phụ huynh) và cho GIA SƯ (giọng gia sư) — cùng một trạng thái, hai người nói khác nhau. */
export const PARENT_STATUS_TEXT: Record<RequestStatus, { title: string; detail: string }> = {
  new:      { title: "Đang chờ gia sư xem", detail: "KiN đã chuyển yêu cầu của anh/chị tới gia sư. Gia sư sẽ liên hệ qua số Zalo anh/chị đã để lại. KiN không đảm bảo thời gian phản hồi." },
  accepted: { title: "Gia sư đã nhận yêu cầu", detail: "Gia sư đã nhận yêu cầu và sẽ liên hệ để hẹn buổi học thử. Anh/chị tự thoả thuận lịch học và học phí trực tiếp với gia sư; KiN không thu hộ." },
  declined: { title: "Gia sư chưa nhận được lần này", detail: "Gia sư chưa sắp xếp được lớp cho yêu cầu này. Anh/chị có thể xem gia sư khác trên KiN. Số liên hệ anh/chị để lại đã được xoá khỏi yêu cầu." },
  closed:   { title: "Yêu cầu đã đóng", detail: "Yêu cầu đã được rút lại hoặc hết hạn. Số liên hệ đã được xoá khỏi yêu cầu." },
};
export const TUTOR_STATUS_TEXT: Record<RequestStatus, string> = { new: "Mới, chưa phản hồi", accepted: "Đã nhận", declined: "Đã từ chối", closed: "Đã đóng hoặc hết hạn" };

export const SUBJECT_MAX = 60;
export const SLOTS_MAX = 120;
export const NOTE_MAX = 300;
export const CONTACT_NAME_MAX = 60;
/** Yêu cầu chưa ai phản hồi sau chừng này ngày thì tự đóng và xoá số liên hệ. */
export const REQUEST_EXPIRE_DAYS = 30;
/** Tối thiểu giữ trang trước khi gửi (ms): người thật không điền xong dưới 3 giây. */
export const MIN_FILL_MS = 3000;
export const MAX_FILL_MS = 6 * 3600_000;
export const PER_PHONE_PER_DAY = 3;
export const PER_IP_PER_HOUR = 5;

export type RequesterRole = "guardian" | "self";

export const REQUEST_CONSENT_TEXT: Record<RequesterRole, string> = {
  guardian: "Tôi là phụ huynh / người giám hộ của người học. Tôi đồng ý để KiN chuyển cấp học, môn, khung giờ, ghi chú, tên và số Zalo của tôi cho gia sư tôi đã chọn, để gia sư liên hệ về việc học. Nếu gia sư nhận yêu cầu, gia sư có thể ghi tên và thông tin liên hệ của con tôi vào sổ lớp của gia sư trên KiN, chỉ để dạy học và liên lạc về lớp học.",
  self: "Tôi là người học, đã đủ 16 tuổi. Tôi đồng ý để KiN chuyển cấp học, môn, khung giờ, ghi chú, tên và số Zalo của tôi cho gia sư tôi đã chọn, để gia sư liên hệ về việc học. Nếu gia sư nhận yêu cầu, gia sư có thể ghi tên và thông tin liên hệ của tôi vào sổ lớp của gia sư trên KiN, chỉ để dạy học và liên lạc về lớp học.",
};
export const REQUEST_CONSENT_NOTE =
  "KiN ghi lại việc bạn bấm đồng ý (lúc nào, chữ nào). KiN không kiểm tra bạn có đúng là phụ huynh hay người học nên đây là lời xác nhận của chính bạn, không phải KiN đã xác minh. Bạn rút lại bất cứ lúc nào ở trang theo dõi; khi rút, số liên hệ bị xoá khỏi yêu cầu.";

export const isRequestLevel = (v: unknown): v is RequestLevel => typeof v === "string" && (REQUEST_LEVELS as readonly string[]).includes(v);
export const isRequesterRole = (v: unknown): v is RequesterRole => v === "guardian" || v === "self";

export interface RequestInput {
  level: RequestLevel; subject: string; mode: TeachingMode | null; slots: string | null; note: string | null; contactName: string | null; contactPhone: string; role: RequesterRole;
}
export interface RequestParse { data?: RequestInput; errors: Record<string, string> }

/** Kiểm thân yêu cầu của khách. Lỗi theo ô, chữ tiếng Việt. Không nhận ô lạ (tên con, ngày sinh… bị bỏ, không lưu). */
export function parseRequestInput(body: unknown): RequestParse {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  if (!isRequestLevel(b.level)) errors.level = "Chọn cấp học";
  const subject = typeof b.subject === "string" ? cleanText(b.subject) : "";
  if (!subject) errors.subject = "Nhập môn cần học"; else if (subject.length > SUBJECT_MAX) errors.subject = `Môn tối đa ${SUBJECT_MAX} ký tự`;
  let mode: TeachingMode | null = null;
  if (b.mode !== undefined && b.mode !== null && b.mode !== "") {
    if ((TEACHING_MODES as readonly string[]).includes(b.mode as string)) mode = b.mode as TeachingMode; else errors.mode = "Hình thức học không hợp lệ";
  }
  const opt = (k: "slots" | "note" | "contactName", max: number, label: string): string | null => {
    const raw = b[k];
    if (raw === undefined || raw === null || raw === "") return null;
    if (typeof raw !== "string") { errors[k] = `${label} không hợp lệ`; return null; }
    const t = cleanText(raw);
    if (t.length > max) { errors[k] = `${label} tối đa ${max} ký tự`; return null; }
    return t || null;
  };
  const slots = opt("slots", SLOTS_MAX, "Khung giờ"), note = opt("note", NOTE_MAX, "Ghi chú"), contactName = opt("contactName", CONTACT_NAME_MAX, "Tên");
  const phone = typeof b.contactPhone === "string" ? normalizeZaloPhone(b.contactPhone) : null;
  if (!phone) errors.contactPhone = "Số Zalo phải đủ 10 chữ số, để gia sư liên hệ lại";
  if (!isRequesterRole(b.role)) errors.role = "Chọn bạn là phụ huynh hay người học";
  if (Object.keys(errors).length) return { errors };
  return { errors, data: { level: b.level as RequestLevel, subject, mode, slots, note, contactName, contactPhone: phone!, role: b.role as RequesterRole } };
}

export type SpamVerdict = "ok" | "bot" | "too-fast" | "stale";
/** Ô bẫy `website` (ẩn với người thật) có chữ → bot. `startedAt` là mốc ms lúc trang mở; gửi dưới MIN_FILL_MS hoặc quá MAX_FILL_MS (hoặc thiếu) → không nhận. */
export function spamVerdict(o: { website: unknown; startedAt: unknown; now: number }): SpamVerdict {
  if (typeof o.website === "string" ? o.website.trim() !== "" : o.website !== undefined && o.website !== null && o.website !== "") return "bot";
  if (typeof o.startedAt !== "number" || !Number.isFinite(o.startedAt) || o.startedAt > o.now) return "stale";
  const age = o.now - o.startedAt;
  return age < MIN_FILL_MS ? "too-fast" : age > MAX_FILL_MS ? "stale" : "ok";
}

export const isTrackToken = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
export const requestExpireCutoff = (now: Date): Date => new Date(now.getTime() - REQUEST_EXPIRE_DAYS * 86_400_000);
export const trackUrl = (origin: string, token: string): string => `${origin.replace(/\/+$/, "")}/yeu-cau/${token}`;
