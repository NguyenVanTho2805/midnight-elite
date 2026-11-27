import { canChu, LoiDuLieu } from "@/lib/quyen";
import { docJson, route } from "@/server/api";
import { datKhoaTaiKhoan } from "@/server/nguoi-dung";

/** { khoa: true | false } — chỉ chủ (T55). Khoá kèm thu hồi mọi phiên; chủ còn hoạt động cuối cùng → 409 `chu_cuoi`. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  if (typeof b.khoa !== "boolean") throw new LoiDuLieu("khoa phải là true hoặc false");
  return datKhoaTaiKhoan(u, p.id, b.khoa);
});
