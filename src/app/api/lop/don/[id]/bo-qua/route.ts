import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { boQuaDon } from "@/lib/lop/server/don";

/** { lyDo } — chỉ chủ (T43). Trả nhatKyId để Hoàn tác. Quyền trước tham số. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return boQuaDon(u, soNguyen(p.id, "id"), String((await docJson(req)).lyDo ?? ""));
});
