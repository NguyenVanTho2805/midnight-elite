// Token phiên (không chạm CSDL — proxy.ts dùng được). Cookie ký HS256 (jose). T23: giữ 30 ngày, tự gia hạn (proxy.ts),
// chủ khoá phiên ngay bằng nguoi_dung.phien_huy_luc / khoa_luc (kiểm mỗi request).
import { SignJWT, jwtVerify } from "jose";

export const TEN_COOKIE = "bca_phien";
export const HAN_GIAY = 30 * 24 * 3600;
export type Phien = { sub: string; vai: "nd" | "hs"; bd: number }; // bd = giây bắt đầu phiên (giữ nguyên khi gia hạn)

/** Máy cục bộ = không chạy trên Vercel (VERCEL_ENV chưa đặt). */
export const mayCucBo = () => !process.env.VERCEL_ENV;
/**
 * Điều kiện cần của đăng nhập thử (chỉ đọc env). T40: cục bộ + BCA_DEV_LOGIN=1, hoặc preview + BCA_DEV_LOGIN=1;
 * preview còn phải có dấu DU_LIEU_GIA trong DB — route kiểm bằng dang-nhap-thu.dangNhapThuBat().
 */
export const devLoginBat = () => process.env.BCA_DEV_LOGIN === "1" && (mayCucBo() || process.env.VERCEL_ENV === "preview");

function khoa() {
  const s = process.env.BCA_SESSION_SECRET ?? (mayCucBo() && process.env.NODE_ENV !== "production" ? "chi-dung-tren-may-cuc-bo-khong-phai-bi-mat" : "");
  if (s.length < 16) throw new Error("Thiếu BCA_SESSION_SECRET (≥ 16 ký tự) — bắt buộc ở mọi nơi trừ máy cục bộ");
  return new TextEncoder().encode(s);
}

export const kyPhien = async (p: Phien) =>
  new SignJWT({ vai: p.vai, bd: p.bd }).setProtectedHeader({ alg: "HS256" }).setSubject(p.sub).setIssuedAt().setExpirationTime(`${HAN_GIAY}s`).sign(khoa());

export async function docPhien(token?: string | null): Promise<(Phien & { iat: number }) | null> {
  if (!token) return null;
  const k = khoa(); // thiếu khoá là lỗi cấu hình — ném ra, không nuốt thành "chưa đăng nhập"
  try {
    const { payload: p } = await jwtVerify(token, k, { algorithms: ["HS256"] });
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
    if (p.slice(0, i).trim() !== ten) continue;
    try {
      return decodeURIComponent(p.slice(i + 1).trim());
    } catch {
      return null; // % hỏng ⇒ coi như không có phiên (401), không 500
    }
  }
  return null;
}
