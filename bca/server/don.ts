// Đơn đăng ký — chỉ chủ (phan-quyen.md Điều 3). Đợt 1 chỉ đọc danh sách.
import { canChu, LoiDuLieu, type Nguoi } from "@/lib/quyen";

const TRANG_THAI_DON = ["moi", "cho_duyet", "da_nhan", "trung", "bo_qua", "lead_cu"];
import { db } from "./db";
import { napMon } from "./du-lieu";

export async function danhSachDon(u: Nguoi, opt: { trangThai?: string } = {}) {
  canChu(u);
  if (opt.trangThai && !TRANG_THAI_DON.includes(opt.trangThai)) throw new LoiDuLieu(`trang_thai phải là một trong: ${TRANG_THAI_DON.join(", ")}`);
  const mons = new Map((await napMon()).map((m) => [m.id, m.ma]));
  const ds = await db.don_dang_ky.findMany({
    where: opt.trangThai ? { trang_thai: opt.trangThai as never } : {},
    orderBy: { thoi_gian: "desc" },
    include: { hoc_sinh: { select: { ma_hs: true } } },
  });
  return { don: ds.map(({ hoc_sinh, mon_ids, ...d }) => ({ ...d, mon: mon_ids.map((id) => mons.get(id)), ma_hs: hoc_sinh?.ma_hs ?? d.ma_hs_cu })) };
}
