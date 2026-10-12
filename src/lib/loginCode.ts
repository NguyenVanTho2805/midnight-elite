// TK-170 — đăng nhập bằng mã 6 số gửi qua email (Figma "Đăng nhập" 21:9). Phần THUẦN (không đụng cơ sở dữ liệu, không gửi email)
// để test được từng quy tắc. Phần có cơ sở dữ liệu ở src/lib/loginCodeServer.ts.
//
// Quy tắc (theo Figma, bản đồ đường vào 33:2):
//   - mã 6 số, sống 10 phút, dùng một lần
//   - sai 5 lần thì khoá email đó 15 phút (chặn người đoán mã, không phải phạt người dùng)
//   - xin mã mới được sau 60 giây
//   - lưu mã đã băm, so bằng hàm so sánh thời gian hằng định, không bao giờ so bằng ==
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60_000;
export const RESEND_MS = 60_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Chuẩn hoá email (cắt khoảng trắng, chữ thường); trả null nếu không giống một email. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length === 0 || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

/** Chuẩn hoá mã người nhập (bỏ khoảng trắng và gạch nối khi dán); trả null nếu không đúng 6 chữ số. */
export function normalizeCodeInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}

/** Mã ngẫu nhiên an toàn mật mã, 000000–999999 (giữ số 0 đầu). */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** HMAC-SHA256 theo khoá bí mật của máy chủ, gắn với email để cùng một mã của hai người ra hai giá trị băm khác nhau. */
export function hashCode(email: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

/** So hai chuỗi băm bằng hàm so sánh thời gian hằng định. */
export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

export interface CodeState {
  codeHash: string;
  attempts: number;
  sentAt: Date;
  expiresAt: Date;
  lockedUntil: Date | null;
}

export type RequestPlan =
  | { action: "send"; attempts: number }
  | { action: "wait"; retryAfterSec: number }
  | { action: "locked"; retryAfterSec: number };

const sec = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

/** Có đang bị khoá không (khoá còn hiệu lực, hoặc đã dùng hết lượt sai nhưng chưa kịp ghi mốc khoá). */
function isLocked(s: CodeState, now: Date): boolean {
  if (s.lockedUntil && s.lockedUntil > now) return true;
  return !s.lockedUntil && s.attempts >= MAX_ATTEMPTS && s.sentAt.getTime() + LOCK_MS > now.getTime();
}

function lockRemainingMs(s: CodeState, now: Date): number {
  return (s.lockedUntil ?? new Date(s.sentAt.getTime() + LOCK_MS)).getTime() - now.getTime();
}

/**
 * Xin mã mới.
 *  - đang khoá → không gửi
 *  - chưa đủ 60 giây từ lần gửi trước → chờ
 *  - còn lại → gửi. Số lần sai ĐƯỢC GIỮ nếu mã trước gửi trong vòng 15 phút (không lách giới hạn 5 lần bằng cách xin mã liên tục);
 *    quá 15 phút hoặc khoá đã hết thì tính lại từ 0.
 */
export function planRequest(state: CodeState | null, now: Date): RequestPlan {
  if (!state) return { action: "send", attempts: 0 };
  if (isLocked(state, now)) return { action: "locked", retryAfterSec: sec(lockRemainingMs(state, now)) };
  const sinceSent = now.getTime() - state.sentAt.getTime();
  if (sinceSent < RESEND_MS) return { action: "wait", retryAfterSec: sec(RESEND_MS - sinceSent) };
  const carry = sinceSent < LOCK_MS && state.attempts < MAX_ATTEMPTS ? state.attempts : 0;
  return { action: "send", attempts: carry };
}

export type BlockedReason =
  | { reason: "none" }
  | { reason: "expired" }
  | { reason: "locked"; retryAfterSec: number };

/**
 * Khi KHÔNG còn lượt thử (hoặc không có mã) thì lý do là gì. Gọi sau khi thao tác trừ lượt nguyên tử không thành.
 * Khoá đã hết hạn thì mã cũ coi như hết hạn: người xin mã mới.
 */
export function classifyBlocked(state: CodeState | null, now: Date): BlockedReason {
  if (!state) return { reason: "none" };
  if (isLocked(state, now)) return { reason: "locked", retryAfterSec: sec(lockRemainingMs(state, now)) };
  return { reason: "expired" };
}

/** Còn mấy lần thử sau khi đã dùng `used` lần (không âm). */
export function attemptsLeft(used: number): number {
  return Math.max(0, MAX_ATTEMPTS - used);
}

/** Mốc mã hết hạn nếu gửi lúc `now`. */
export function expiryFor(now: Date): Date {
  return new Date(now.getTime() + CODE_TTL_MS);
}

/** Mốc hết khoá nếu bị khoá lúc `now`. */
export function lockUntilFor(now: Date): Date {
  return new Date(now.getTime() + LOCK_MS);
}
