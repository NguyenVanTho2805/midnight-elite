// Phân công giáo viên — chỉ chủ (T55, phan-quyen.md 5.1–5.2). Thay bca/server/nguoi-dung.ts cho KiN:
// tài khoản giáo viên do khu quản trị KiN tạo (User role admin + adminRole teacher). Ở đây CHỈ ĐỌC bảng users; chỉ ghi bca_nguoi_dung + bca_phan_cong.
// Không tạo người dùng, không đổi mật khẩu, không thu hồi phiên KiN. Khoá dòng lớp có hiệu lực ngay (nguoiLopBca đọc khoa_luc mỗi request).
import { prisma as db } from "@/lib/prisma";
import { canChu, LoiDuLieu, type Nguoi } from "../quyen";
import { chuanHoaGmail, gmailGoc } from "../chuan-hoa";
import type { Tx } from "./du-lieu";
import { ghiNhatKy } from "./nhat-ky";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** san_sang: đăng nhập KiN là vào được lớp · chua_xac_minh: có tài khoản KiN nhưng email chưa xác minh · bi_cam: tài khoản KiN bị khoá · chua_co_tk: dòng lớp không khớp giáo viên KiN nào. */
export type TrangThaiGv = "san_sang" | "chua_xac_minh" | "bi_cam" | "chua_co_tk";

export async function manGiaoVien(u: Nguoi) {
  canChu(u);
  const [kin, nd, mon] = await Promise.all([
    db.user.findMany({ where: { role: "admin", adminRole: "teacher" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, emailVerified: true, banned: true } }),
    db.bcaNguoiDung.findMany({ where: { vai_tro: "giao_vien" }, orderBy: { tao_luc: "asc" }, include: { phan_cong: { include: { mon: { select: { ma: true, thu_tu: true } } } } } }),
    db.bcaMon.findMany({ orderBy: { thu_tu: "asc" }, select: { ma: true, ten_ngan: true } }),
  ]);
  const lop = (x: (typeof nd)[number]) => ({ id: x.id, khoa: !!x.khoa_luc, mon: x.phan_cong.map((p) => p.mon).sort((a, b) => a.thu_tu - b.thu_tu).map((m) => m.ma) });
  const daKhop = new Set<string>();
  const coTk = kin.map((k) => {
    const dong = nd.find((x) => gmailGoc(x.gmail) === gmailGoc(k.email));
    if (dong) daKhop.add(dong.id);
    const trang_thai: TrangThaiGv = k.banned ? "bi_cam" : k.emailVerified ? "san_sang" : "chua_xac_minh";
    return { userId: k.id as string | null, ten: k.name, email: k.email, trang_thai, lop: dong ? lop(dong) : null };
  });
  const moCoi = nd.filter((x) => !daKhop.has(x.id)).map((x) => ({ userId: null as string | null, ten: x.ten_hien_thi, email: x.gmail, trang_thai: "chua_co_tk" as TrangThaiGv, lop: lop(x) }));
  return { mon, giao_vien: [...coTk, ...moCoi] };
}

async function monIds(tx: Tx, v: unknown) {
  if (!Array.isArray(v) || v.some((m) => typeof m !== "string")) throw new LoiDuLieu("mon phải là danh sách mã môn");
  const ma = [...new Set(v as string[])];
  const mons = await tx.bcaMon.findMany({ where: { ma: { in: ma } }, select: { id: true, ma: true } });
  const thieu = ma.filter((m) => !mons.some((x) => x.ma === m));
  if (thieu.length) throw new LoiDuLieu(`Không có môn: ${thieu.join(", ")}`);
  return mons;
}
const layGv = async (tx: Tx, id: string) => {
  if (!UUID.test(id)) throw new LoiDuLieu("Không có giáo viên này", 404);
  const nd = await tx.bcaNguoiDung.findUnique({ where: { id }, include: { phan_cong: { include: { mon: { select: { ma: true } } } } } });
  if (!nd) throw new LoiDuLieu("Không có giáo viên này", 404);
  // Dòng vai chủ do phiên KiN (admin_super) quyết định, không phân công / khoá ở đây.
  if (nd.vai_tro !== "giao_vien") throw new LoiDuLieu("Chủ lớp thấy mọi môn — không phân công, không khoá ở đây", 409, "la_chu");
  return nd;
};

/** Đưa một giáo viên KiN vào lớp: tạo dòng lớp theo Gmail đã xác minh rồi gán môn. Gmail trên hồ sơ học sinh ⇒ chỉ cảnh báo (T49). */
export async function themGiaoVien(u: Nguoi, v: { userId?: unknown; mon?: unknown }) {
  canChu(u);
  const kin = typeof v.userId === "string" && v.userId ? await db.user.findUnique({ where: { id: v.userId }, select: { name: true, email: true, role: true, adminRole: true, emailVerified: true, banned: true } }) : null;
  if (!kin || kin.role !== "admin" || kin.adminRole !== "teacher") throw new LoiDuLieu("Không có tài khoản giáo viên KiN này — tạo ở Con người › Tài khoản hệ thống trước", 404, "chua_co_tk");
  if (kin.banned) throw new LoiDuLieu("Tài khoản KiN của giáo viên này đang bị khoá — mở khoá ở khu quản trị KiN trước", 409, "bi_cam");
  if (!kin.emailVerified) throw new LoiDuLieu("Email của giáo viên này chưa xác minh — nhờ giáo viên bấm liên kết xác minh trong thư KiN rồi thử lại", 409, "chua_xac_minh");
  const gmail = chuanHoaGmail(kin.email)!, goc = gmailGoc(gmail);
  const ten = kin.name.replace(/\s+/g, " ").trim().slice(0, 80) || gmail;
  return db.$transaction(async (tx) => {
    const mons = await monIds(tx, v.mon ?? []);
    if ((await tx.bcaNguoiDung.findMany({ select: { gmail: true } })).some((x) => gmailGoc(x.gmail) === goc))
      throw new LoiDuLieu("Giáo viên này đã có trong lớp — sửa môn ở dòng của họ", 409, "trung");
    const hs = (await tx.bcaHocSinh.findMany({ where: { gmail: { not: null } }, select: { ma_hs: true, gmail: true } })).filter((x) => gmailGoc(x.gmail) === goc).map((x) => x.ma_hs);
    const nd = await tx.bcaNguoiDung.create({ data: { gmail, ten_hien_thi: ten, vai_tro: "giao_vien" } });
    if (mons.length) await tx.bcaPhanCong.createMany({ data: mons.map((m) => ({ nguoi_dung_id: nd.id, mon_id: m.id })) });
    await ghiNhatKy(u, "them_giao_vien", "nguoi_dung", nd.id, null, { ten_hien_thi: ten, mon: mons.map((m) => m.ma) }, tx);
    return { id: nd.id, gmail, ten, mon: mons.map((m) => m.ma), trung_ho_so_hs: hs };
  });
}

/** Đặt lại môn phụ trách của một giáo viên. Bỏ môn có hiệu lực ngay từ request kế tiếp của giáo viên. */
export async function phanCong(u: Nguoi, id: string, mon: unknown) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const nd = await layGv(tx, id);
    const truoc = { mon: nd.phan_cong.map((p) => p.mon.ma) };
    const mons = await monIds(tx, mon);
    await tx.bcaPhanCong.deleteMany({ where: { nguoi_dung_id: id, mon_id: { notIn: mons.map((m) => m.id) } } });
    const co = new Set(nd.phan_cong.map((p) => p.mon_id));
    const them = mons.filter((m) => !co.has(m.id));
    if (them.length) await tx.bcaPhanCong.createMany({ data: them.map((m) => ({ nguoi_dung_id: id, mon_id: m.id })) });
    await ghiNhatKy(u, "phan_cong", "nguoi_dung", id, truoc, { mon: mons.map((m) => m.ma) }, tx);
    return { id, mon: mons.map((m) => m.ma) };
  });
}

/** Khoá / mở khoá dòng lớp của giáo viên (không đụng tài khoản KiN). Khoá ⇒ giáo viên không đọc, không ghi gì ở lớp. */
export async function datKhoaGiaoVien(u: Nguoi, id: string, khoa: boolean, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const nd = await layGv(tx, id);
    if (khoa === !!nd.khoa_luc) return { id, khoa };
    await tx.bcaNguoiDung.update({ where: { id }, data: { khoa_luc: khoa ? luc : null } });
    await ghiNhatKy(u, khoa ? "khoa_tai_khoan" : "mo_khoa_tai_khoan", "nguoi_dung", id, { khoa_luc: nd.khoa_luc?.toISOString() ?? null }, { khoa_luc: khoa ? luc.toISOString() : null }, tx);
    return { id, khoa };
  });
}
