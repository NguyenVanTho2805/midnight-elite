import { canChu } from "@/lib/quyen";
import { docJson, route } from "@/server/api";
import { danhSachNguoiDung, themGiaoVien } from "@/server/nguoi-dung";

export const GET = route((u) => danhSachNguoiDung(u));

/** { gmail, ten, mon?: ["toan", …] } — chỉ chủ (T55): thêm giáo viên. Gmail đã có tài khoản (so dạng gốc) → 409 `trung`. */
export const POST = route(async (u, req) => {
  canChu(u);
  const b = await docJson(req);
  return themGiaoVien(u, { gmail: b.gmail, ten: b.ten, mon: b.mon });
});
