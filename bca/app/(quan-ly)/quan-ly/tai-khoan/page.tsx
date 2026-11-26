// Tài khoản (T55) — chỉ chủ lớp: thêm giáo viên (Gmail, tên, môn), sửa, khoá/mở khoá, đăng xuất mọi máy.
// GV mở trang này ⇒ forbidden (máy chủ chặn trong manTaiKhoan, API trả 403).
import { manTaiKhoan } from "@/server/nguoi-dung";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { ManTaiKhoan } from "@/components/quan-ly/tai-khoan";

export const metadata = { title: "Tài khoản" };

export default async function TrangTaiKhoan() {
  const u = await layNguoiQuanLy();
  const d = await tai(() => manTaiKhoan(u));
  return <ManTaiKhoan toi={d.toi} mon={d.mon} taiKhoan={d.tai_khoan.map(({ khoa_luc: _k, ...t }) => t)} />;
}
