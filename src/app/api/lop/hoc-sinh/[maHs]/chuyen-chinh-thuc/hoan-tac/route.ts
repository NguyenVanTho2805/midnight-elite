import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacChuyenChinhThuc } from "@/lib/lop/server/ghi-danh";

/** { nhatKyId } (trả về từ chuyển chính thức) — chỉ chủ, một lần, trong hạn hoàn tác. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  return hoanTacChuyenChinhThuc(u, p.maHs, soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
