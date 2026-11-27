import { cauHinhGoogle, COOKIE_TAM, HAN_TAM_GIAY, ngauNhien, redirectUri, urlGoogle } from "@/server/google";
import { chuoiCookie, kyTam } from "@/server/token";

/** GET — bắt đầu đăng nhập Google: state + PKCE + nonce cất trong cookie ký 10 phút (chỉ gửi về đường dẫn callback), rồi chuyển sang Google. */
export async function GET(req: Request) {
  const cfg = cauHinhGoogle();
  if (!cfg) return new Response(null, { status: 303, headers: { location: "/dang-nhap?loi=chua_cau_hinh", "cache-control": "no-store" } });
  const state = ngauNhien(), nonce = ngauNhien(), verifier = ngauNhien();
  const redirect = redirectUri(req);
  const tam = await kyTam("google", { state, nonce, verifier, redirect }, HAN_TAM_GIAY);
  return new Response(null, {
    status: 302,
    headers: {
      location: await urlGoogle(cfg.clientId, redirect, state, nonce, verifier),
      "set-cookie": chuoiCookie(COOKIE_TAM, tam, HAN_TAM_GIAY, "/api/dang-nhap/google"),
      "cache-control": "no-store",
    },
  });
}
