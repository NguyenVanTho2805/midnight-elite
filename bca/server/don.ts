// Đơn đăng ký — chỉ chủ (phan-quyen.md Điều 3). Đợt 1 chỉ đọc danh sách.
import { trang_thai_don } from "@/generated/prisma/enums";
import { canChu, LoiDuLieu, type Nguoi } from "@/lib/quyen";
import { db } from "./db";
import { napMon } from "./du-lieu";

const TRANG_THAI_DON: string[] = Object.values(trang_thai_don);

export async function danhSachDon(u: Nguoi, opt: { trangThai?: string } = {}) {
  canChu(u);
  if (opt.trangThai && !TRANG_THAI_DON.includes(opt.trangThai)) throw new LoiDuLieu(`trang_thai phải là một trong: ${TRANG_THAI_DON.join(", ")}`);
  const mons = new Map((await napMon()).map((m) => [m.id, m.ma]));
  const ds = await db.don_dang_ky.findMany({
    where: opt.trangThai ? { trang_thai: opt.trangThai as trang_thai_don } : {},
    orderBy: { thoi_gian: "desc" },
    include: { hoc_sinh: { select: { ma_hs: true } } },
  });
  return { don: ds.map(({ hoc_sinh, mon_ids, ...d }) => ({ ...d, mon: mon_ids.map((id) => mons.get(id)), ma_hs: hoc_sinh?.ma_hs ?? d.ma_hs_cu })) };
}
