import { canChu } from "@/lib/quyen";
import { docJson, route } from "@/server/api";
import { suaNguoiDung } from "@/server/nguoi-dung";

/** { ten?, mon?: [...] } — chỉ chủ (T55): sửa tên; đặt lại môn phụ trách của giáo viên. */
export const PATCH = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  return suaNguoiDung(u, p.id, { ten: b.ten, mon: b.mon });
});
