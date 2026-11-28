import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacNghiMon } from "@/lib/lop/server/ghi-danh";

/** { nhatKyId } (trả về từ cho nghỉ) — chỉ chủ, một lần, trong hạn hoàn tác. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  return hoanTacNghiMon(u, p.maHs, soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
