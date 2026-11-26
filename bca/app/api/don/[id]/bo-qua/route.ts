import { canChu } from "@/lib/quyen";
import { docJson, route, soNguyen } from "@/server/api";
import { boQuaDon } from "@/server/don";

/** { lyDo } — chỉ chủ (T43). Trả nhatKyId để Hoàn tác. Quyền trước tham số: GV/học sinh luôn 403. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return boQuaDon(u, soNguyen(p.id, "id"), String((await docJson(req)).lyDo ?? ""));
});
