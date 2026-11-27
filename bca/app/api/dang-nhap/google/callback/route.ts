import { cauHinhGoogle, COOKIE_TAM, doiCodeLayEmail, LoiDangNhap, timTaiKhoan, type MaLoi } from "@/server/google";
import { chuoiCookie, docCookie, docTam, HAN_GIAY, kyPhien, TEN_COOKIE } from "@/server/token";

const ve = (location: string, ...cookie: string[]) => {
  const h = new Headers({ location, "cache-control": "no-store" });
  for (const c of cookie) h.append("set-cookie", c);
  return new Response(null, { status: 303, headers: h });
};

/** GET ?code&state — Google gọi về. Kiểm state (cookie ký), đổi code + code_verifier, kiểm id_token, đối chiếu Gmail với DB, cấp cookie phiên như cũ. */
export async function GET(req: Request) {
  const xoaTam = chuoiCookie(COOKIE_TAM, "", 0, "/api/dang-nhap/google");
  const loi = (ma: MaLoi) => ve(`/dang-nhap?loi=${ma}`, xoaTam);
  const cfg = cauHinhGoogle();
  if (!cfg) return loi("chua_cau_hinh");
  const q = new URL(req.url).searchParams;
  const tam = await docTam("google", docCookie(req.headers.get("cookie"), COOKIE_TAM));
  const state = q.get("state"), code = q.get("code");
  // State sai/thiếu/cookie hết hạn ⇒ không tin bất kỳ tham số nào khác (chống CSRF đăng nhập).
  if (!tam || typeof tam.state !== "string" || !state || state !== tam.state) return loi("het_han");
  // access_denied = người dùng bấm Huỷ; lỗi khác (cấu hình client sai…) không đổ cho người dùng.
  if (q.get("error")) return loi(q.get("error") === "access_denied" ? "huy" : "google_loi");
  if (!code) return loi("google_loi");
  try {
    const email = await doiCodeLayEmail(code, String(tam.verifier), String(tam.nonce), String(tam.redirect), cfg);
    const phien = await timTaiKhoan(email);
    return ve("/", chuoiCookie(TEN_COOKIE, await kyPhien(phien), HAN_GIAY), xoaTam);
  } catch (e) {
    if (e instanceof LoiDangNhap) return loi(e.ma);
    throw e;
  }
}
