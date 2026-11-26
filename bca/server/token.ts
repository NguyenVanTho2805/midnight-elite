// Token phiên (không chạm CSDL — proxy.ts dùng được). Cookie ký HS256 (jose). T23: giữ 30 ngày, tự gia hạn (proxy.ts),
// chủ khoá phiên ngay bằng nguoi_dung.phien_huy_luc / khoa_luc (kiểm mỗi request).
import { SignJWT, jwtVerify } from "jose";

export const TEN_COOKIE = "bca_phien";
export const HAN_GIAY = 30 * 24 * 3600;
export type Phien = { sub: string; vai: "nd" | "hs"; bd: number }; // bd = giây bắt đầu phiên (giữ nguyên khi gia hạn)

export const devLoginBat = () => process.env.BCA_DEV_LOGIN === "1" && process.env.VERCEL_ENV !== "production";

function khoa() {
  const s = process.env.BCA_SESSION_SECRET ?? (devLoginBat() ? "chi-dung-tren-may-dev-khong-phai-bi-mat" : "");
  if (s.length < 16) throw new Error("Thiếu BCA_SESSION_SECRET (≥ 16 ký tự)");
  return new TextEncoder().encode(s);
}

export const kyPhien = (p: Phien) =>
  new SignJWT({ vai: p.vai, bd: p.bd }).setProtectedHeader({ alg: "HS256" }).setSubject(p.sub).setIssuedAt().setExpirationTime(`${HAN_GIAY}s`).sign(khoa());

export async function docPhien(token?: string | null): Promise<(Phien & { iat: number }) | null> {
  if (!token) return null;
  try {
    const { payload: p } = await jwtVerify(token, khoa(), { algorithms: ["HS256"] });
    if ((p.vai !== "nd" && p.vai !== "hs") || !p.sub || typeof p.bd !== "number") return null;
    return { sub: p.sub, vai: p.vai, bd: p.bd, iat: p.iat ?? 0 };
  } catch {
    return null;
  }
}

export const cookieOpt = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: HAN_GIAY, secure: process.env.NODE_ENV === "production" };

export function docCookie(header: string | null, ten = TEN_COOKIE) {
  for (const p of (header ?? "").split(";")) {
    const i = p.indexOf("=");
    if (p.slice(0, i).trim() === ten) return decodeURIComponent(p.slice(i + 1).trim());
  }
  return null;
}
