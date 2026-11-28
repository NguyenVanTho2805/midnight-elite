import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { themGiaoVien } from "@/lib/lop/server/giao-vien";

/** { userId (User KiN vai giáo viên, email đã xác minh), mon: ["toan", …] } — chỉ chủ. Chỉ tạo dòng bca_nguoi_dung + phân công. */
export const POST = route(async (u, req) => {
  canChu(u);
  const b = await docJson(req);
  return themGiaoVien(u, { userId: b.userId, mon: b.mon });
});
