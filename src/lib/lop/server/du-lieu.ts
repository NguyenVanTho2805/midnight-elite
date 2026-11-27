// Nạp dữ liệu dùng chung của lớp (chép từ bca/server/du-lieu.ts, đổi sang client Prisma của KiN + model Bca*).
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { d2s, d2sOrNull } from "../ngay";
import { MAC_DINH, type GD } from "../quy-tac";

export type Tx = Prisma.TransactionClient;
/** Khoá dòng buổi (FOR UPDATE) trong transaction ghi: hai thao tác cùng buổi chạy lần lượt. Gọi SAU khi đã kiểm quyền. */
export const khoaBuoi = (tx: Tx, id: number) => tx.$queryRaw`SELECT id FROM bca_buoi_hoc WHERE id = ${id} FOR UPDATE`;
/** Chỉ mốc sinh buổi; đơn giá KHÔNG đọc ở đây (học phí chờ chủ, README mục 6.4). */
export async function ngayBatDauLop() {
  const r = await prisma.bcaCaiDat.findUnique({ where: { khoa: "NGAY_BAT_DAU_TINH_PHI" } });
  return String(r?.gia_tri ?? MAC_DINH.NGAY_BAT_DAU_TINH_PHI);
}

type GDRow = { id: number; ma_gd: string; hoc_sinh_id: number; mon_id: number; loai: GD["loai"]; tu_ngay: Date; den_ngay: Date | null; huy_luc: Date | null; nghi_luc: Date | null };
export const toGD = (r: GDRow): GD & { hoc_sinh_id: number } => ({
  id: r.id, ma_gd: r.ma_gd, hoc_sinh_id: r.hoc_sinh_id, mon_id: r.mon_id, loai: r.loai,
  tu: d2s(r.tu_ngay), den: d2sOrNull(r.den_ngay), huy: !!r.huy_luc, nghi: !!r.nghi_luc,
});

/** Chỉ cột cần cho quy tắc — không kéo đơn giá riêng, miễn phí, ghi chú (GV dùng chung hàm này). */
const COT_GD = { id: true, ma_gd: true, hoc_sinh_id: true, mon_id: true, loai: true, tu_ngay: true, den_ngay: true, huy_luc: true, nghi_luc: true } as const;
export async function napGD(where: { hoc_sinh_id?: number | { in: number[] }; mon_id?: { in: number[] } } = {}, tx: Tx = prisma) {
  const rows = await tx.bcaGhiDanh.findMany({ where, select: COT_GD, orderBy: [{ tu_ngay: "asc" }, { id: "asc" }] });
  const theoHs = new Map<number, (GD & { hoc_sinh_id: number })[]>();
  for (const r of rows) {
    const g = toGD(r);
    theoHs.set(g.hoc_sinh_id, [...(theoHs.get(g.hoc_sinh_id) ?? []), g]);
  }
  return theoHs;
}

export const napMon = () => prisma.bcaMon.findMany({ orderBy: { thu_tu: "asc" } });

/** Tên người được phân công từng môn (kể cả chủ; chỉ tên hiển thị, tài khoản chưa khoá) — cho chi tiết buổi. */
export async function giaoVienTheoMon(monIds: number[]) {
  const pc = await prisma.bcaPhanCong.findMany({
    where: { mon_id: { in: monIds }, nguoi_dung: { khoa_luc: null } },
    select: { mon_id: true, nguoi_dung: { select: { ten_hien_thi: true } } },
    orderBy: { tao_luc: "asc" },
  });
  const ra = new Map<number, string[]>(monIds.map((id) => [id, []]));
  for (const p of pc) ra.get(p.mon_id)?.push(p.nguoi_dung.ten_hien_thi);
  return ra;
}
