// "Tiếp tục với Facebook" cho HỌC SINH (08/11/2026). Authorization Code (có state ký trong cookie httpOnly 10 phút) + Graph API lấy id, name, email.
// Khác Google: Facebook không trả cờ email_verified và có thể không trả email → luật ở socialAuth.ts (không tự liên kết theo email; chỉ tạo mới khi email chưa có).
// Không PKCE: Facebook Login không công bố hỗ trợ code_challenge; chống CSRF bằng state, chống đánh cắp mã bằng client_secret ở bước đổi mã.
import type { SocialProfile } from "@/lib/socialAuth";

type Env = Record<string, string | undefined>;
const V = "v19.0";
export const FACEBOOK_COOKIE = "kin_facebook";

/** Cả hai biến đều có thì nút mới hiện. */
export function facebookEnabled(env: Env = process.env): boolean {
  return !!(env.FACEBOOK_APP_ID?.trim() && env.FACEBOOK_APP_SECRET?.trim());
}

/** Ngoài production mới cho đổi địa chỉ (test dựng Facebook giả); production luôn địa chỉ thật. */
export function facebookEndpoints(env: Env = process.env) {
  const prod = env.NODE_ENV === "production";
  return {
    auth: (!prod && env.FACEBOOK_AUTH_URL) || `https://www.facebook.com/${V}/dialog/oauth`,
    token: (!prod && env.FACEBOOK_TOKEN_URL) || `https://graph.facebook.com/${V}/oauth/access_token`,
    me: (!prod && env.FACEBOOK_GRAPH_URL) || `https://graph.facebook.com/${V}/me`,
  };
}

/** <tên miền chính>/api/auth/facebook/callback — FACEBOOK_REDIRECT_URI nếu chủ đặt, không thì suy từ yêu cầu. */
export function facebookRedirectUri(req: Request, env: Env = process.env): string {
  if (env.FACEBOOK_REDIRECT_URI?.trim()) return env.FACEBOOK_REDIRECT_URI.trim();
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}/api/auth/facebook/callback`;
}

export function buildFacebookAuthUrl(o: { appId: string; redirectUri: string; state: string; authUrl: string }): string {
  const u = new URL(o.authUrl);
  u.search = new URLSearchParams({ client_id: o.appId, redirect_uri: o.redirectUri, state: o.state, response_type: "code", scope: "email,public_profile" }).toString();
  return u.toString();
}

/** Đọc trả lời của Graph /me?fields=id,name,email. Email có thể vắng → null (quyết định ở socialAuth: không có email thì từ chối). */
export function profileFromGraph(me: unknown): SocialProfile | null {
  if (!me || typeof me !== "object") return null;
  const m = me as Record<string, unknown>;
  if (typeof m.id !== "string" || !m.id) return null;
  const email = typeof m.email === "string" && m.email.includes("@") ? m.email.trim().toLowerCase() : null;
  const name = (typeof m.name === "string" ? m.name.trim() : "") || (email ? email.split("@")[0] : "Học sinh");
  return { id: m.id, email, name: name.slice(0, 100) };
}
