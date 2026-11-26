import { dangNhapThuBat, phienThu, VAI_THU, type VaiThu } from "@/server/dang-nhap-thu";
import { cookieOpt, kyPhien, TEN_COOKIE } from "@/server/token";

/** POST { vai } — T40: chỉ khi BCA_DEV_LOGIN=1, không phải production và DB có dấu DU_LIEU_GIA. Còn lại 404. */
export async function POST(req: Request) {
  if (!(await dangNhapThuBat())) return new Response("Not found", { status: 404 });
  const { vai } = (await req.json().catch(() => ({}))) as { vai?: string };
  if (typeof vai !== "string" || !Object.hasOwn(VAI_THU, vai)) return Response.json({ loi: "Vai không hợp lệ" }, { status: 400 });
  const p = await phienThu(vai as VaiThu);
  if (!p) return Response.json({ loi: "Không tìm được người phù hợp vai này trong dữ liệu" }, { status: 404 });
  const c = `${TEN_COOKIE}=${await kyPhien(p)}; Path=/; Max-Age=${cookieOpt.maxAge}; HttpOnly; SameSite=Lax${cookieOpt.secure ? "; Secure" : ""}`;
  return Response.json({ ok: true, vai }, { headers: { "set-cookie": c } });
}
