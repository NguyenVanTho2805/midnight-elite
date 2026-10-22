// ĐX-02 — thông báo đẩy (Web Push) cho GIA SƯ: các quy tắc THUẦN (không Prisma, không mạng, không đọc đồng hồ ngầm) để test từng ca biên.
// Phần gửi thật ở src/lib/pushServer.ts; phần nối vào notify() ở src/lib/notify.ts.
//
// Nguyên tắc đã chốt với Thọ (Q2, 21/10):
//  • Chữ đẩy dựng từ LOẠI thông báo, KHÔNG lấy `message` của thông báo trong ứng dụng (message có tên học sinh, số tiền; màn hình khoá hiện chữ).
//  • Giờ yên lặng 22:00–07:00 (classSessions.ts): chỉ tạo thông báo trong ứng dụng, không đẩy — trừ báo nghỉ sát giờ (còn dưới 2 giờ là tới giờ học).
//  • Chỉ gửi thật khi PUSH_ENABLED=1 (đặt ở môi trường Production) và đủ khoá VAPID; bản xem trước của Vercel dùng chung DB với production nên không bao giờ gửi.
//  • Loại tin ban đầu: absence_late, bank_tx_pending (mặc định BẬT) và invoice_paid (tuỳ chọn, mặc định TẮT).
//  • NC2-010/011: thêm parent_reported (phụ huynh bấm "Tôi đã chuyển") và unmarked_daily (07:00 "Hôm qua có N buổi chưa điểm danh"), cả hai mặc định TẮT.
//    Số duy nhất được phép đưa vào chữ đẩy là N của unmarked_daily (một số nguyên 1–999, truyền qua `count`); không tên, không số tiền.
import { ABSENCE_NOTICE_MINUTES, inQuietHours, vnMinutesOfDay } from "@/lib/classSessions";

export const PUSH_TYPES = ["absence_late", "bank_tx_pending", "invoice_paid", "parent_reported", "unmarked_daily"] as const;
export type PushType = (typeof PUSH_TYPES)[number];
export type PushTypes = Record<PushType, boolean>;

export interface PushTypeDef {
  /** Tên hiện ở trang Cài đặt. */
  label: string;
  /** Một dòng mô tả ở trang Cài đặt. */
  hint: string;
  defaultOn: boolean;
  /** Chữ hiện trên màn hình khoá — KHÔNG có tên em, điểm hay số tiền. */
  title: string;
  body: string;
  /** Trang mở khi bấm vào tin (đường dẫn cùng tên miền). */
  url: string;
  /** Giây dịch vụ đẩy giữ tin nếu máy đang tắt: báo nghỉ sát giờ quá giờ học thì vô nghĩa nên giữ ngắn. */
  ttl: number;
}

export const PUSH_DEFS: Record<PushType, PushTypeDef> = {
  absence_late: {
    label: "Báo nghỉ sát giờ", hint: "Phụ huynh báo nghỉ trong vòng 2 giờ trước giờ học, cần bạn xử lý.", defaultOn: true,
    title: "Có 1 báo nghỉ sát giờ cần xử lý", body: "Bấm để mở Hộp việc.", url: "/lop-cua-toi", ttl: 2 * 3600,
  },
  bank_tx_pending: {
    label: "Khoản tiền vào chưa khớp phiếu", hint: "Tiền về nhưng KiN chưa tự gạch được, cần bạn xem.", defaultOn: true,
    title: "Có khoản tiền vào chưa khớp phiếu", body: "Bấm để xem và gạch thủ công.", url: "/lop-cua-toi/hoc-phi?tab=doi-soat", ttl: 12 * 3600,
  },
  invoice_paid: {
    label: "Phiếu học phí đã đóng đủ", hint: "Tuỳ chọn, mặc định tắt.", defaultOn: false,
    title: "Có phiếu học phí vừa đóng đủ", body: "Bấm để xem phiếu.", url: "/lop-cua-toi/hoc-phi", ttl: 12 * 3600,
  },
  parent_reported: {
    label: "Phụ huynh báo đã chuyển khoản", hint: "Có phụ huynh báo đã chuyển khoản, cần đối soát. Mặc định tắt.", defaultOn: false,
    title: "Có phụ huynh báo đã chuyển khoản, cần đối soát", body: "Bấm để xem phiếu học phí.", url: "/lop-cua-toi/hoc-phi", ttl: 12 * 3600,
  },
  unmarked_daily: {
    label: "Nhắc điểm danh buổi hôm qua", hint: "7 giờ sáng báo hôm qua còn bao nhiêu buổi chưa điểm danh. Mặc định tắt.", defaultOn: false,
    // Chữ gốc KHÔNG có số; pushPayload("unmarked_daily", { count }) chèn N.
    title: "Hôm qua có buổi chưa điểm danh", body: "Bấm để mở Hộp việc.", url: "/lop-cua-toi", ttl: 12 * 3600,
  },
};

/** N hợp lệ của unmarked_daily: số nguyên 1–999. */
export const isUnmarkedCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 999;

export const PUSH_TEST_TEXT = { title: "Thông báo thử từ KiN", body: "Nếu bạn thấy dòng này, thông báo đẩy đã hoạt động.", url: "/lop-cua-toi/cai-dat" } as const;

export const isPushType = (t: unknown): t is PushType => typeof t === "string" && (PUSH_TYPES as readonly string[]).includes(t);
export const MAX_PUSH_DEVICES = 10;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Giá trị đã lưu → đủ ba công tắc (thiếu / hỏng thì dùng mặc định). Đọc khoan dung, không ném lỗi. */
export function resolvePushTypes(raw: unknown): PushTypes {
  const out = {} as PushTypes;
  for (const t of PUSH_TYPES) out[t] = isObj(raw) && typeof raw[t] === "boolean" ? raw[t] : PUSH_DEFS[t].defaultOn;
  return out;
}

/** Đọc `preferences.push.types` trong DB: chỉ giữ công tắc đúng kiểu và đúng tên (dùng ở readPreferences). */
export function readPushPrefs(raw: unknown): { types: Partial<PushTypes> } | null {
  if (!isObj(raw) || !isObj(raw.types)) return null;
  const types: Partial<PushTypes> = {};
  for (const t of PUSH_TYPES) if (typeof raw.types[t] === "boolean") types[t] = raw.types[t] as boolean;
  return Object.keys(types).length ? { types } : null;
}

/** Bản vá công tắc từ trang Cài đặt. Ghi thì nghiêm: tên lạ hoặc không phải đúng/sai → từ chối cả bản vá. */
export function parsePushTypesPatch(raw: unknown): { ok: true; value: Partial<PushTypes> } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const keys = Object.keys(raw);
  if (keys.length === 0) return { ok: false, error: "Không có công tắc nào để đổi" };
  const value: Partial<PushTypes> = {};
  for (const k of keys) {
    if (!isPushType(k)) return { ok: false, error: `Không có loại thông báo "${k.slice(0, 40)}"` };
    if (typeof raw[k] !== "boolean") return { ok: false, error: `"${k}" phải là đúng-sai` };
    value[k] = raw[k] as boolean;
  }
  return { ok: true, value };
}

export type PushSkip = "type-not-allowed" | "type-off" | "quiet-hours";
export type PushDecision = { send: true } | { send: false; reason: PushSkip };

/**
 * Có đẩy tin này lúc này không?
 * `leadMinutes` chỉ có nghĩa với absence_late (còn bao nhiêu phút tới giờ học): dưới ngưỡng sát giờ (2 giờ) thì đẩy cả trong giờ yên lặng.
 * Thiếu `leadMinutes` thì KHÔNG coi là khẩn (mặc định tôn trọng giờ yên lặng).
 */
export function decidePush(o: { type: string; types: PushTypes; now: Date; leadMinutes?: number }): PushDecision {
  if (!isPushType(o.type)) return { send: false, reason: "type-not-allowed" };
  if (!o.types[o.type]) return { send: false, reason: "type-off" };
  const urgent = o.type === "absence_late" && typeof o.leadMinutes === "number" && Number.isFinite(o.leadMinutes) && o.leadMinutes < ABSENCE_NOTICE_MINUTES;
  if (!urgent && inQuietHours(vnMinutesOfDay(o.now))) return { send: false, reason: "quiet-hours" };
  return { send: true };
}

export interface PushPayload { title: string; body: string; url: string }

/**
 * Chữ gửi đi cho một loại — hàm của `type`; ngoại lệ DUY NHẤT là `opts.count` (chỉ unmarked_daily): số buổi chưa điểm danh hôm qua.
 * `count` không hợp lệ (không phải số nguyên 1–999) hoặc dùng cho loại khác thì bị bỏ qua — chữ vẫn là chữ gốc của loại.
 */
export function pushPayload(type: PushType, opts: { count?: number } = {}): PushPayload {
  const d = PUSH_DEFS[type];
  const title = type === "unmarked_daily" && isUnmarkedCount(opts.count) ? `Hôm qua có ${opts.count} buổi chưa điểm danh` : d.title;
  return { title, body: d.body, url: d.url };
}

/** Chuỗi JSON gửi qua dịch vụ đẩy: đúng ba khoá, không thêm gì (service worker chỉ tin ba khoá này). */
export const serializePayload = (p: PushPayload): string => JSON.stringify({ title: p.title, body: p.body, url: p.url });

// ── Cấu hình môi trường ──────────────────────────────────────────────────────────────────────────

export type PushOff = "disabled" | "preview" | "no-keys";
export interface PushConfig { enabled: boolean; reason: PushOff | null; publicKey: string | null; privateKey: string | null; subject: string | null }
const VAPID_KEY = /^[A-Za-z0-9_-]{20,200}$/;
const VAPID_SUBJECT = /^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s/]+\S*)$/;

/**
 * Được phép gửi thật không? Cần PUSH_ENABLED=1, không phải bản xem trước Vercel (VERCEL_ENV=preview dùng chung DB với production nên
 * lỡ đặt PUSH_ENABLED ở đó cũng không gửi) và đủ ba biến VAPID đúng dạng. Chạy cục bộ (không có VERCEL_ENV) thì chỉ cần PUSH_ENABLED=1 để thử.
 */
export function pushConfig(env: Record<string, string | undefined>): PushConfig {
  const off = (reason: PushOff): PushConfig => ({ enabled: false, reason, publicKey: null, privateKey: null, subject: null });
  if (env.PUSH_ENABLED !== "1") return off("disabled");
  if (env.VERCEL_ENV === "preview") return off("preview");
  const pub = env.VAPID_PUBLIC_KEY?.trim(), priv = env.VAPID_PRIVATE_KEY?.trim(), subject = env.VAPID_SUBJECT?.trim();
  if (!pub || !priv || !subject || !VAPID_KEY.test(pub) || !VAPID_KEY.test(priv) || !VAPID_SUBJECT.test(subject)) return off("no-keys");
  return { enabled: true, reason: null, publicKey: pub, privateKey: priv, subject };
}

// ── Đăng ký thiết bị ─────────────────────────────────────────────────────────────────────────────

/**
 * Dịch vụ đẩy của các trình duyệt phổ biến. Máy chủ KiN sẽ gửi yêu cầu tới `endpoint` do trình duyệt đưa lên, nên phải giới hạn tên miền
 * — nếu không, một tài khoản gia sư có thể đăng ký địa chỉ nội bộ và dùng máy chủ để gọi (SSRF).
 */
export const PUSH_HOST_SUFFIXES = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"] as const;
export const ENDPOINT_MAX = 2048;

export function isAllowedPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > ENDPOINT_MAX) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") || u.hash) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some(s => h === s || h.endsWith(`.${s}`));
}

export interface ValidSubscription { endpoint: string; p256dh: string; auth: string; userAgent: string | null }
const B64URL_P256DH = /^[A-Za-z0-9_-]{80,100}$/;  // khoá công khai 65 byte → 87 ký tự
const B64URL_AUTH = /^[A-Za-z0-9_-]{16,32}$/;     // 16 byte → 22 ký tự
const UA_MAX = 300;

/** Đối tượng `PushSubscription.toJSON()` của trình duyệt + userAgent tuỳ chọn → bản đã kiểm, hoặc lỗi. */
export function parseSubscription(raw: unknown): { ok: true; value: ValidSubscription } | { ok: false; error: string } {
  if (!isObj(raw) || !isObj(raw.subscription)) return { ok: false, error: "Thiếu thông tin đăng ký thiết bị" };
  const s = raw.subscription;
  if (!isAllowedPushEndpoint(s.endpoint)) return { ok: false, error: "Địa chỉ nhận thông báo không hợp lệ" };
  const keys = isObj(s.keys) ? s.keys : {};
  if (typeof keys.p256dh !== "string" || !B64URL_P256DH.test(keys.p256dh) || typeof keys.auth !== "string" || !B64URL_AUTH.test(keys.auth)) {
    return { ok: false, error: "Khoá của thiết bị không hợp lệ" };
  }
  const ua = typeof raw.userAgent === "string" ? raw.userAgent.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, UA_MAX) : "";
  return { ok: true, value: { endpoint: s.endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua || null } };
}

/** "Chrome · Android" từ chuỗi userAgent — chỉ để gia sư nhận ra máy nào; không đoán tên đời máy. */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (!s) return "Thiết bị khác";
  const browser = /Edg(e|A|iOS)?\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /SamsungBrowser\//.test(s) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(s) ? "Firefox" : /Chrome\/|CriOS\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "Mac" : /Linux|X11/.test(s) ? "Linux" : "";
  if (!browser && !os) return "Thiết bị khác";
  return [browser, os].filter(Boolean).join(" · ");
}

/** Dấu vân tay của endpoint (SHA-256 hex) để trang Cài đặt nhận ra "máy này" mà không phải đưa endpoint lên URL. Chạy được ở cả trình duyệt và Node. */
export async function endpointFingerprint(endpoint: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}
export const isFingerprint = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
