import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { datKhoaGiaoVien } from "@/lib/lop/server/giao-vien";

/** { khoa: boolean } — chỉ chủ. Khoá / mở khoá dòng lớp của giáo viên (không đụng tài khoản KiN). */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return datKhoaGiaoVien(u, p.id, (await docJson(req)).khoa === true);
});
