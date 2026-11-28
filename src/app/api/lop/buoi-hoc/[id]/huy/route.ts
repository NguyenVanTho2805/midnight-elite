import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { huyBuoi } from "@/lib/lop/server/buoi-hoc";

/** { lyDo, xacNhan? } — chỉ chủ. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  return huyBuoi(u, soNguyen(p.id, "id"), String(b.lyDo ?? ""), b.xacNhan === true);
});
