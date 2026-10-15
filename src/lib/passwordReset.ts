// Quên mật khẩu (15/10/2026). Phần THUẦN: không đụng cơ sở dữ liệu, không gửi thư — để test từng quy tắc. Phần có cơ sở dữ liệu ở
// src/app/api/auth/forgot-password và reset-password.
//
// Quy tắc:
//   - link đặt lại sống 30 phút (trước đây 60 phút), dùng MỘT lần; mỗi tài khoản chỉ có một link còn hiệu lực
//   - cơ sở dữ liệu chỉ lưu BĂM (HMAC-SHA256) của link, không lưu link: ai đọc được bảng cũng không đặt lại được mật khẩu của người khác
//   - xin link mới được sau 60 giây; một email không quá 3 lần xin trong 30 phút (không để ai dội thư vào hộp thư người khác)
//   - mật khẩu mới: 8–1024 ký tự (cùng ngưỡng với đăng ký)
import { createHmac, randomBytes } from "node:crypto";

export const RESET_TTL_MS = 30 * 60_000;
export const RESEND_MS = 60_000;
export const MAX_REQUESTS = 3;
export const REQUEST_WINDOW_MS = 30 * 60_000;
export { MIN_PASSWORD_LEN, MAX_PASSWORD_LEN, validateNewPassword } from "@/lib/passwordPolicy";
const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Link ngẫu nhiên an toàn mật mã: 32 byte = 64 ký tự hex. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** Chuẩn hoá link người dùng gửi lên; trả null nếu không đúng dạng (đỡ phải đụng cơ sở dữ liệu với rác). */
export function parseResetToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return TOKEN_RE.test(t) ? t : null;
}

/** Giá trị lưu trong cột `token`: HMAC-SHA256 theo khoá bí mật của máy chủ. */
export function hashResetToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(`password-reset:${token}`).digest("hex");
}

/** Giờ gửi của một link, suy từ hạn (bảng không có cột createdAt; hạn = giờ gửi + RESET_TTL_MS). */
export function sentAtOf(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - RESET_TTL_MS);
}

export type RequestPlan =
  | { action: "send" }
  | { action: "wait"; retryAfterSec: number };

/** Có được gửi link mới không: đang trong 60 giây kể từ lần gửi trước thì chờ (không gửi thêm, không đổi link đang sống). */
export function planRequest(existing: { expiresAt: Date } | null, now: Date): RequestPlan {
  if (!existing || existing.expiresAt.getTime() <= now.getTime()) return { action: "send" };
  const since = now.getTime() - sentAtOf(existing.expiresAt).getTime();
  if (since < RESEND_MS) return { action: "wait", retryAfterSec: Math.max(1, Math.ceil((RESEND_MS - since) / 1000)) };
  return { action: "send" };
}

export type TokenCheck = { ok: true } | { ok: false; reason: "invalid" | "expired" };

/** Link có dùng được không: không có bản ghi = không hợp lệ / đã dùng; quá hạn = hết hạn. */
export function checkToken(record: { expiresAt: Date } | null, now: Date): TokenCheck {
  if (!record) return { ok: false, reason: "invalid" };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

export const INVALID_MESSAGE = "Link không hợp lệ hoặc đã được dùng rồi. Hãy yêu cầu link mới.";
export const EXPIRED_MESSAGE = "Link đã hết hạn (chỉ sống 30 phút). Hãy yêu cầu link mới.";
