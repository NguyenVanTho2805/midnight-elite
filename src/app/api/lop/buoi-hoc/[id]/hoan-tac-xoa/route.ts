import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacXoaBuoi } from "@/lib/lop/server/buoi-hoc";

/** { nhatKyId } (từ DELETE /api/lop/buoi-hoc/[id]) — chỉ chủ, trong 10 giây (T42). Quyền trước tham số: GV luôn 403. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return hoanTacXoaBuoi(u, soNguyen(p.id, "id"), soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
