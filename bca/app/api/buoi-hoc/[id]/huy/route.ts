import { docJson, route, soNguyen } from "@/server/api";
import { huyBuoi } from "@/server/buoi-hoc";

/** { lyDo, xacNhan? } — chỉ chủ. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return huyBuoi(u, soNguyen(p.id, "id"), String(b.lyDo ?? ""), b.xacNhan === true);
});
