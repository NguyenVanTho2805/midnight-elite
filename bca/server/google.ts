// Đăng nhập Google (OpenID Connect, authorization code + PKCE + state + nonce). T17: chỉ Gmail đã có trong hệ thống —
// chủ/GV theo nguoi_dung.gmail (chủ nhập), học sinh theo hoc_sinh.gmail. Không tự tạo tài khoản.
// Không ghi nhật ký khi đăng nhập: chuyen-tu-sheet coi nhật ký có người dùng là "web đã vận hành" (chặn --apply).
import { createRemoteJWKSet, jwtVerify } from "jose";
import { gmailGoc } from "@/lib/chuan-hoa";
import { db } from "./db";
import type { Phien } from "./token";

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISS = ["https://accounts.google.com", "accounts.google.com"];
export const DUONG_CALLBACK = "/api/dang-nhap/google/callback";
export const COOKIE_TAM = "bca_google";
export const HAN_TAM_GIAY = 600;

/** null = thiếu biến ⇒ nút Google ẩn, route báo "chưa cấu hình" (không sập). */
export function cauHinhGoogle() {
  const clientId = process.env.BCA_GOOGLE_CLIENT_ID?.trim(), clientSecret = process.env.BCA_GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** BCA_APP_URL (khuyên đặt ở production) hoặc gốc của request. Phải khớp Authorized redirect URI trong Google Cloud. */
export function redirectUri(req: Request) {
  const goc = process.env.BCA_APP_URL?.trim().replace(/\/+$/, "") || new URL(req.url).origin;
  return goc + DUONG_CALLBACK;
}

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const ngauNhien = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
export const pkceChallenge = async (verifier: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

export async function urlGoogle(clientId: string, redirect: string, state: string, nonce: string, verifier: string) {
  const u = new URL(GOOGLE_AUTH);
  u.search = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirect, scope: "openid email",
    state, nonce, code_challenge: await pkceChallenge(verifier), code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return u.toString();
}

export class LoiDangNhap extends Error {
  constructor(public ma: MaLoi) {
    super(ma);
  }
}
export type MaLoi = "chua_cau_hinh" | "huy" | "het_han" | "google_loi" | "chua_xac_minh" | "khong_co_tai_khoan" | "tai_khoan_khoa" | "ho_so_an" | "trung_gmail";

let jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS));
/** Chỉ cho test: tạo lại bộ khoá (xoá bộ nhớ đệm JWKS). */
export const _datLaiJwks = () => (jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS)));

/** Đổi code lấy id_token rồi kiểm chữ ký (JWKS của Google), iss, aud, hạn, nonce, email_verified. Trả email đã chuẩn hoá. */
export async function doiCodeLayEmail(code: string, verifier: string, nonce: string, redirect: string, cfg: { clientId: string; clientSecret: string }) {
  let idToken: unknown;
  try {
    const r = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`token ${r.status}`);
    idToken = ((await r.json()) as { id_token?: unknown }).id_token;
  } catch {
    throw new LoiDangNhap("google_loi");
  }
  if (typeof idToken !== "string") throw new LoiDangNhap("google_loi");
  let p;
  try {
    ({ payload: p } = await jwtVerify(idToken, jwks, { issuer: GOOGLE_ISS, audience: cfg.clientId, algorithms: ["RS256"] }));
  } catch {
    throw new LoiDangNhap("google_loi");
  }
  if (p.nonce !== nonce) throw new LoiDangNhap("google_loi");
  if (p.email_verified !== true && p.email_verified !== "true") throw new LoiDangNhap("chua_xac_minh");
  const email = gmailGoc(p.email);
  if (!email || !email.includes("@")) throw new LoiDangNhap("chua_xac_minh");
  return email;
}

/** Tìm tài khoản theo Gmail dạng gốc. Thứ tự: chủ/GV trước (T49), rồi hồ sơ học sinh. Trùng nhiều dòng ⇒ từ chối (T48). */
export async function timTaiKhoan(email: string, luc = new Date()): Promise<Phien> {
  const goc = gmailGoc(email)!;
  const laGmail = goc.endsWith("@gmail.com");
  const where = { OR: [{ gmail: { equals: goc, mode: "insensitive" as const } }, ...(laGmail ? ["@gmail.com", "@googlemail.com"].map((d) => ({ gmail: { endsWith: d, mode: "insensitive" as const } })) : [])] };
  const khop = <T extends { gmail: string | null }>(rows: T[]) => rows.filter((r) => gmailGoc(r.gmail) === goc);
  const bd = Math.floor(luc.getTime() / 1000);

  const nd = khop(await db.nguoi_dung.findMany({ where, select: { id: true, gmail: true, khoa_luc: true } }));
  if (nd.length > 1) throw new LoiDangNhap("trung_gmail");
  if (nd.length === 1) {
    if (nd[0].khoa_luc) throw new LoiDangNhap("tai_khoan_khoa");
    return { sub: nd[0].id, vai: "nd", bd };
  }
  const hs = khop(await db.hoc_sinh.findMany({ where, select: { id: true, gmail: true, an_luc: true } }));
  if (hs.length > 1) throw new LoiDangNhap("trung_gmail");
  if (hs.length === 1) {
    if (hs[0].an_luc) throw new LoiDangNhap("ho_so_an");
    return { sub: String(hs[0].id), vai: "hs", bd };
  }
  throw new LoiDangNhap("khong_co_tai_khoan");
}
