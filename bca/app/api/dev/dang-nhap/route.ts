import { phienThu, VAI_THU, type VaiThu } from "@/server/dang-nhap-thu";
import { cookieOpt, devLoginBat, kyPhien, TEN_COOKIE } from "@/server/token";

/** POST { vai } — chỉ tồn tại khi BCA_DEV_LOGIN=1 (ngoài production). */
export async function POST(req: Request) {
  if (!devLoginBat()) return new Response("Not found", { status: 404 });
  const { vai } = (await req.json().catch(() => ({}))) as { vai?: string };
  if (!vai || !(vai in VAI_THU)) return Response.json({ loi: "Vai không hợp lệ" }, { status: 400 });
  const p = await phienThu(vai as VaiThu);
  if (!p) return Response.json({ loi: "Không tìm được người phù hợp vai này trong dữ liệu" }, { status: 404 });
  const c = `${TEN_COOKIE}=${await kyPhien(p)}; Path=/; Max-Age=${cookieOpt.maxAge}; HttpOnly; SameSite=Lax${cookieOpt.secure ? "; Secure" : ""}`;
  return Response.json({ ok: true, vai }, { headers: { "set-cookie": c } });
}
