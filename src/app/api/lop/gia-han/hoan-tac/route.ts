import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacGiaHan } from "@/lib/lop/server/ghi-danh";

/** { nhatKyId } — chỉ chủ, một lần, trong hạn hoàn tác (T29). */
export const POST = route(async (u, req) => {
  canChu(u);
  return hoanTacGiaHan(u, soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
