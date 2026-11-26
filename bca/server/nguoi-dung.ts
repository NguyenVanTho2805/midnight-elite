// Tài khoản chủ/GV — chỉ chủ. T23: thu hồi mọi phiên của một người ngay lập tức.
import { canChu, LoiDuLieu, type Nguoi } from "@/lib/quyen";
import { db } from "./db";
import { ghiNhatKy } from "./nhat-ky";

export async function danhSachNguoiDung(u: Nguoi) {
  canChu(u);
  return db.nguoi_dung.findMany({ orderBy: { tao_luc: "asc" }, include: { phan_cong: { include: { mon: { select: { ma: true } } } } } });
}

export async function thuHoiPhien(u: Nguoi, id: string, khoaTaiKhoan = false, luc = new Date()) {
  canChu(u);
  const nd = await db.nguoi_dung.findUnique({ where: { id } });
  if (!nd) throw new LoiDuLieu("Không có người dùng này", 404);
  await db.nguoi_dung.update({ where: { id }, data: { phien_huy_luc: luc, ...(khoaTaiKhoan ? { khoa_luc: luc } : {}) } });
  await ghiNhatKy(u, khoaTaiKhoan ? "khoa_tai_khoan" : "thu_hoi_phien", "nguoi_dung", id, { khoa_luc: nd.khoa_luc }, { phien_huy_luc: luc.toISOString(), khoa: khoaTaiKhoan });
  return { ok: true };
}
