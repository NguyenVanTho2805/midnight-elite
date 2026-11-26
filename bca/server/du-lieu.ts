// Nạp dữ liệu dùng chung. Lớp có ~70 em, ~200 ghi danh: nạp gọn rồi tính bằng hàm thuần ở lib/.
import { d2s, d2sOrNull } from "@/lib/ngay";
import { MAC_DINH, type GD } from "@/lib/quy-tac";
import { db, type Tx } from "./db";

type GDRow = { id: number; ma_gd: string; hoc_sinh_id: number; mon_id: number; loai: GD["loai"]; tu_ngay: Date; den_ngay: Date | null; huy_luc: Date | null; nghi_luc: Date | null };
export const toGD = (r: GDRow): GD & { hoc_sinh_id: number } => ({
  id: r.id, ma_gd: r.ma_gd, hoc_sinh_id: r.hoc_sinh_id, mon_id: r.mon_id, loai: r.loai,
  tu: d2s(r.tu_ngay), den: d2sOrNull(r.den_ngay), huy: !!r.huy_luc, nghi: !!r.nghi_luc,
});

export async function napGD(where: { hoc_sinh_id?: number | { in: number[] }; mon_id?: { in: number[] } } = {}, tx: Tx = db) {
  const rows = await tx.ghi_danh.findMany({ where, orderBy: [{ tu_ngay: "asc" }, { id: "asc" }] });
  const theoHs = new Map<number, (GD & { hoc_sinh_id: number })[]>();
  for (const r of rows) {
    const g = toGD(r);
    theoHs.set(g.hoc_sinh_id, [...(theoHs.get(g.hoc_sinh_id) ?? []), g]);
  }
  return theoHs;
}

export async function caiDat(tx: Tx = db) {
  const rows = await tx.cai_dat.findMany({ where: { khoa: { in: ["SO_NGAY_HOC_THU", "NGAY_BAT_DAU_TINH_PHI", "GIA_1_MON", "GIA_TU_2_MON"] } } });
  const v = Object.fromEntries(rows.map((r) => [r.khoa, r.gia_tri]));
  return {
    SO_NGAY_HOC_THU: Number(v.SO_NGAY_HOC_THU ?? MAC_DINH.SO_NGAY_HOC_THU),
    NGAY_BAT_DAU_TINH_PHI: String(v.NGAY_BAT_DAU_TINH_PHI ?? MAC_DINH.NGAY_BAT_DAU_TINH_PHI),
    GIA_1_MON: Number(v.GIA_1_MON ?? MAC_DINH.GIA_1_MON),
    GIA_TU_2_MON: Number(v.GIA_TU_2_MON ?? MAC_DINH.GIA_TU_2_MON),
  };
}

export const napMon = (tx: Tx = db) => tx.mon.findMany({ orderBy: { thu_tu: "asc" } });
export async function monTheoMa(ma: string) {
  const m = await db.mon.findUnique({ where: { ma } });
  return m;
}

/** Cấp mã mới không bao giờ cấp lại (bo_dem, UPDATE … RETURNING trong transaction). */
export async function capMa(tx: Tx, khoa: "hs" | "gd") {
  const r = await tx.bo_dem.update({ where: { khoa }, data: { gia_tri: { increment: 1 } } });
  return khoa === "hs" ? `HS${String(r.gia_tri).padStart(4, "0")}` : `GD${String(r.gia_tri).padStart(5, "0")}`;
}
