// Tài khoản chủ/GV — chỉ chủ (T55, phan-quyen.md 5.1–5.2). T23: thu hồi mọi phiên của một người ngay lập tức.
// Không khoá được chủ còn hoạt động cuối cùng (kể cả tự khoá mình) — tránh khoá mất quyền quản trị.
import { canChu, LoiDuLieu, type Nguoi } from "@/lib/quyen";
import { chuanHoaGmail, gmailGoc, gmailHopLe, goiYGmail } from "@/lib/chuan-hoa";
import { db, type Tx } from "./db";
import { ghiNhatKy } from "./nhat-ky";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KHOA_TAI_KHOAN = 4243002; // khoá tư vấn: hai lần khoá chủ cùng lúc chạy lần lượt

export async function danhSachNguoiDung(u: Nguoi) {
  canChu(u);
  return db.nguoi_dung.findMany({ orderBy: { tao_luc: "asc" }, include: { phan_cong: { include: { mon: { select: { ma: true } } } } } });
}

/** Cho màn Tài khoản: tài khoản + môn có thể phân công + id của chính chủ đang xem. */
export async function manTaiKhoan(u: Nguoi) {
  canChu(u);
  const [nd, mon] = await Promise.all([
    db.nguoi_dung.findMany({ orderBy: [{ vai_tro: "asc" }, { tao_luc: "asc" }], include: { phan_cong: { include: { mon: { select: { ma: true } } } } } }),
    db.mon.findMany({ orderBy: { thu_tu: "asc" }, select: { ma: true, ten_ngan: true } }),
  ]);
  return {
    toi: u.id,
    mon,
    tai_khoan: nd.map((x) => ({
      id: x.id, gmail: x.gmail, ten: x.ten_hien_thi, vai: x.vai_tro, khoa: !!x.khoa_luc, khoa_luc: x.khoa_luc,
      mon: x.phan_cong.map((p) => p.mon.ma),
    })),
  };
}

function tenHopLe(v: unknown) {
  const t = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (!t || t.length > 80) throw new LoiDuLieu("Tên hiển thị phải có, tối đa 80 ký tự");
  return t;
}
async function monIds(tx: Tx, v: unknown) {
  if (!Array.isArray(v) || v.some((m) => typeof m !== "string")) throw new LoiDuLieu("mon phải là danh sách mã môn");
  const ma = [...new Set(v as string[])];
  const mons = await tx.mon.findMany({ where: { ma: { in: ma } }, select: { id: true, ma: true } });
  const thieu = ma.filter((m) => !mons.some((x) => x.ma === m));
  if (thieu.length) throw new LoiDuLieu(`Không có môn: ${thieu.join(", ")}`);
  return mons;
}
const layTk = async (tx: Tx, id: string) => {
  if (!UUID.test(id)) throw new LoiDuLieu("Không có người dùng này", 404);
  const nd = await tx.nguoi_dung.findUnique({ where: { id }, include: { phan_cong: { include: { mon: { select: { ma: true } } } } } });
  if (!nd) throw new LoiDuLieu("Không có người dùng này", 404);
  return nd;
};

/** Chủ thêm giáo viên: Gmail (chuẩn hoá, so dạng gốc T48 với mọi tài khoản), tên, môn. Gmail trên hồ sơ học sinh ⇒ chỉ cảnh báo (T49: vào vai GV). */
export async function themGiaoVien(u: Nguoi, v: { gmail?: unknown; ten?: unknown; mon?: unknown }) {
  canChu(u);
  const gmail = chuanHoaGmail(v.gmail);
  if (!gmail || !gmailHopLe(gmail)) {
    const goiY = goiYGmail(gmail);
    throw new LoiDuLieu(goiY ? `Gmail có vẻ gõ nhầm — có phải ${goiY}?` : "Gmail không hợp lệ", 400, "gmail");
  }
  const ten = tenHopLe(v.ten);
  return db.$transaction(async (tx) => {
    const mons = await monIds(tx, v.mon ?? []);
    const goc = gmailGoc(gmail);
    if ((await tx.nguoi_dung.findMany({ select: { gmail: true } })).some((x) => gmailGoc(x.gmail) === goc))
      throw new LoiDuLieu("Gmail này đã có tài khoản", 409, "trung");
    const hs = (await tx.hoc_sinh.findMany({ where: { gmail: { not: null } }, select: { ma_hs: true, gmail: true } })).filter((x) => gmailGoc(x.gmail) === goc).map((x) => x.ma_hs);
    const nd = await tx.nguoi_dung.create({ data: { gmail, ten_hien_thi: ten, vai_tro: "giao_vien" } });
    if (mons.length) await tx.phan_cong.createMany({ data: mons.map((m) => ({ nguoi_dung_id: nd.id, mon_id: m.id })) });
    await ghiNhatKy(u, "them_giao_vien", "nguoi_dung", nd.id, null, { ten_hien_thi: ten, mon: mons.map((m) => m.ma) }, tx);
    return { id: nd.id, gmail, ten, mon: mons.map((m) => m.ma), trung_ho_so_hs: hs };
  });
}

/** Sửa tên (mọi tài khoản) và đặt lại môn phụ trách (chỉ giáo viên). Bỏ môn có hiệu lực ngay từ request kế tiếp của GV. */
export async function suaNguoiDung(u: Nguoi, id: string, v: { ten?: unknown; mon?: unknown }) {
  canChu(u);
  if (v.ten === undefined && v.mon === undefined) throw new LoiDuLieu("Không có gì để sửa");
  return db.$transaction(async (tx) => {
    const nd = await layTk(tx, id);
    const truoc = { ten_hien_thi: nd.ten_hien_thi, mon: nd.phan_cong.map((p) => p.mon.ma) };
    const ten = v.ten === undefined ? nd.ten_hien_thi : tenHopLe(v.ten);
    let mon = truoc.mon;
    if (v.mon !== undefined) {
      if (nd.vai_tro !== "giao_vien") throw new LoiDuLieu("Chủ lớp thấy mọi môn — không phân công môn");
      const mons = await monIds(tx, v.mon);
      await tx.phan_cong.deleteMany({ where: { nguoi_dung_id: id, mon_id: { notIn: mons.map((m) => m.id) } } });
      const co = new Set(nd.phan_cong.map((p) => p.mon_id));
      const them = mons.filter((m) => !co.has(m.id));
      if (them.length) await tx.phan_cong.createMany({ data: them.map((m) => ({ nguoi_dung_id: id, mon_id: m.id })) });
      mon = mons.map((m) => m.ma);
    }
    if (ten !== nd.ten_hien_thi) await tx.nguoi_dung.update({ where: { id }, data: { ten_hien_thi: ten } });
    await ghiNhatKy(u, v.mon !== undefined ? "phan_cong" : "sua_nguoi_dung", "nguoi_dung", id, truoc, { ten_hien_thi: ten, mon }, tx);
    return { id, ten, mon };
  });
}

/** Chặn khoá chủ còn hoạt động cuối cùng (gọi trong transaction đã giữ khoá tư vấn). */
async function chanKhoaChuCuoi(tx: Tx, nd: { id: string; vai_tro: string; khoa_luc: Date | null }) {
  if (nd.vai_tro !== "chu" || nd.khoa_luc) return;
  if ((await tx.nguoi_dung.count({ where: { vai_tro: "chu", khoa_luc: null, id: { not: nd.id } } })) === 0)
    throw new LoiDuLieu("Đây là tài khoản chủ lớp duy nhất còn hoạt động — không khoá được", 409, "chu_cuoi");
}

/** Khoá (kèm thu hồi mọi phiên) hoặc mở khoá. Mở khoá không làm sống lại phiên cũ (phien_huy_luc giữ nguyên). */
export async function datKhoaTaiKhoan(u: Nguoi, id: string, khoa: boolean, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TAI_KHOAN})`;
    const nd = await layTk(tx, id);
    if (khoa) await chanKhoaChuCuoi(tx, nd);
    if (khoa === !!nd.khoa_luc) return { id, khoa };
    await tx.nguoi_dung.update({ where: { id }, data: khoa ? { khoa_luc: luc, phien_huy_luc: luc } : { khoa_luc: null } });
    await ghiNhatKy(u, khoa ? "khoa_tai_khoan" : "mo_khoa_tai_khoan", "nguoi_dung", id, { khoa_luc: nd.khoa_luc?.toISOString() ?? null }, { khoa_luc: khoa ? luc.toISOString() : null }, tx);
    return { id, khoa };
  });
}

export async function thuHoiPhien(u: Nguoi, id: string, khoaTaiKhoan = false, luc = new Date()) {
  canChu(u);
  if (!UUID.test(id)) throw new LoiDuLieu("Không có người dùng này", 404);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_TAI_KHOAN})`;
    const nd = await tx.nguoi_dung.findUnique({ where: { id } });
    if (!nd) throw new LoiDuLieu("Không có người dùng này", 404);
    if (khoaTaiKhoan) await chanKhoaChuCuoi(tx, nd);
    await tx.nguoi_dung.update({ where: { id }, data: { phien_huy_luc: luc, ...(khoaTaiKhoan ? { khoa_luc: luc } : {}) } });
    await ghiNhatKy(u, khoaTaiKhoan ? "khoa_tai_khoan" : "thu_hoi_phien", "nguoi_dung", id, { khoa_luc: nd.khoa_luc }, { phien_huy_luc: luc.toISOString(), khoa: khoaTaiKhoan }, tx);
    return { ok: true };
  });
}
