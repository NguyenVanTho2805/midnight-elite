import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { phanCong } from "@/lib/lop/server/giao-vien";

/** { mon: ["toan", …] } — chỉ chủ. `id` = bca_nguoi_dung.id. */
export const PATCH = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return phanCong(u, p.id, (await docJson(req)).mon);
});
