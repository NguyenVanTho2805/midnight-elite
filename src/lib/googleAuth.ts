// "Tiếp tục với Google" cho HỌC SINH (08/11/2026). Authorization Code + PKCE, không thư viện ngoài (chỉ `jose` đã có để ký cookie trạng thái).
// Phần riêng của Google; phần dùng chung (cookie trạng thái, quyết định, ghi DB) ở socialAuth.ts. Hai route /api/auth/google/start và /callback chỉ ráp lại.
//
// Quy tắc (phiếu COO):
//   - Chỉ nhận khi Google xác nhận email_verified = true.
//   - Email mới → học sinh, emailVerified = true, KHÔNG VerifyToken, KHÔNG gửi thư; ví + xu khởi đầu đi đúng đường cũ (signupBonusOps trong cùng giao dịch).
//   - Email đã có: bị khoá → từ chối; học sinh thường → vào; gia sư / quản trị / người có đơn gia sư → KHÔNG vào bằng Google (chống chiếm quyền: ai kiểm soát một
//     hộp thư Google trùng email cũng không được thành gia sư/quản trị đó).
//   - Không thu thêm gì ngoài tên + email (+ `sub` làm khoá liên kết). Không lấy ảnh, không xin scope nào ngoài openid email profile.
import { decodeJwt } from "jose";
import { safeEqual } from "@/lib/socialAuth";

export const GOOGLE_COOKIE = "kin_google";
export { SOCIAL_NOTICES as GOOGLE_NOTICES } from "@/lib/socialNotices";
export const GOOGLE_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_STATE_TTL_SEC = 10 * 60;

const PROD_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const PROD_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Hai biến môi trường đều có thì nút mới hiện. Thiếu một → coi như tắt (không lỗi). */
export function googleEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

/** Địa chỉ Google để chuyển hướng / đổi mã. Chỉ ngoài production mới cho đổi (GOOGLE_AUTH_URL / GOOGLE_TOKEN_URL) để test dựng Google giả — production luôn là địa chỉ thật. */
export function googleEndpoints(env: Record<string, string | undefined> = process.env) {
  const prod = env.NODE_ENV === "production";
  return {
    auth: (!prod && env.GOOGLE_AUTH_URL) || PROD_AUTH_URL,
    token: (!prod && env.GOOGLE_TOKEN_URL) || PROD_TOKEN_URL,
  };
}

/** Redirect URI đăng ký ở Google Cloud: <tên miền chính>/api/auth/google/callback. GOOGLE_REDIRECT_URI nếu chủ đặt; không thì suy từ yêu cầu (Vercel đặt x-forwarded-*). */
export function googleRedirectUri(req: Request, env: Record<string, string | undefined> = process.env): string {
  if (env.GOOGLE_REDIRECT_URI?.trim()) return env.GOOGLE_REDIRECT_URI.trim();
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}/api/auth/google/callback`;
}

export { randomToken, pkceChallenge, safeEqual } from "@/lib/socialAuth";
import { pkceChallenge, readFlow, signFlow, type FlowState } from "@/lib/socialAuth";
export type GoogleFlowState = FlowState;
export const signFlowState = (s: FlowState, env: Record<string, string | undefined> = process.env) => signFlow("google", s, env);
export const readFlowState = (t: string | undefined, env: Record<string, string | undefined> = process.env) => readFlow("google", t, env);

export function buildAuthUrl(o: { clientId: string; redirectUri: string; state: string; nonce: string; verifier: string; authUrl: string }): string {
  const u = new URL(o.authUrl);
  u.search = new URLSearchParams({
    client_id: o.clientId, redirect_uri: o.redirectUri, response_type: "code", scope: "openid email profile",
    state: o.state, nonce: o.nonce, code_challenge: pkceChallenge(o.verifier), code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

export interface GoogleProfile { sub: string; email: string; name: string }
export type ProfileResult = { ok: true; profile: GoogleProfile } | { ok: false; reason: "invalid" | "unverified" };

/** Kiểm các claim của id_token do Google trả TRỰC TIẾP qua TLS ở bước đổi mã (OIDC Core 3.1.3.7: không bắt buộc kiểm chữ ký): iss, aud, exp, nonce, email_verified. */
export function profileFromIdToken(idToken: unknown, o: { clientId: string; nonce: string; now?: number }): ProfileResult {
  let c: Record<string, unknown>;
  try { c = decodeJwt(String(idToken)) as Record<string, unknown>; } catch { return { ok: false, reason: "invalid" }; }
  const now = Math.floor((o.now ?? Date.now()) / 1000);
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") return { ok: false, reason: "invalid" };
  if (!aud.includes(o.clientId)) return { ok: false, reason: "invalid" };
  if (typeof c.exp !== "number" || c.exp <= now) return { ok: false, reason: "invalid" };
  if (typeof c.nonce !== "string" || !safeEqual(c.nonce, o.nonce)) return { ok: false, reason: "invalid" };
  if (typeof c.sub !== "string" || !c.sub || typeof c.email !== "string" || !c.email.includes("@")) return { ok: false, reason: "invalid" };
  if (c.email_verified !== true && c.email_verified !== "true") return { ok: false, reason: "unverified" };
  const email = c.email.trim().toLowerCase();
  const name = (typeof c.name === "string" ? c.name.trim() : "") || email.split("@")[0];
  return { ok: true, profile: { sub: c.sub, email, name: name.slice(0, 100) } };
}

