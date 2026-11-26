// Khu học sinh (dữ liệu cho Đợt 2). Học sinh CHỈ đọc dữ liệu của chính mình (phan-quyen.md 4.3).
// Nội dung buổi + record: chỉ khi em đang có ghi danh môn đó còn hạn hôm nay VÀ có tên ở ngày buổi (QĐ 8, T16, T32).
// Ghi chú điểm danh (T25) không bao giờ trả cho học sinh.
import { congNgay, d2s, gioVN, ngayVN, s2d } from "@/lib/ngay";
import { LoiDuLieu, LoiQuyen, type Nguoi, type NguoiHocSinh } from "@/lib/quyen";
import { hieuLuc, loaiVaoNgay, oMon, tinhTrang, type GD } from "@/lib/quy-tac";
import { db } from "./db";
import { napGD, napMon } from "./du-lieu";

function canHocSinh(u: Nguoi): asserts u is NguoiHocSinh {
  if (u.vai !== "hoc_sinh") throw new LoiQuyen("Khu này dành cho học sinh");
}
const conHan = (gds: GD[], monId: number, h: string) => gds.some((g) => g.mon_id === monId && hieuLuc(g, h));

export async function cuaToi(u: Nguoi, luc = new Date()) {
  canHocSinh(u);
  const h = ngayVN(luc);
  const hs = await db.hoc_sinh.findUniqueOrThrow({
    where: { id: u.hocSinhId },
    select: { ma_hs: true, ho_ten: true, gmail: true, sdt_hs: true, truong: true, khoi: true, username_azota: true, lua: { select: { ma: true, ten: true } } },
  });
  const gds = (await napGD({ hoc_sinh_id: u.hocSinhId })).get(u.hocSinhId) ?? [];
  const mons = (await napMon()).filter((m) => gds.some((g) => g.mon_id === m.id));
  const tu = gds.filter((g) => !g.huy).map((g) => g.tu).sort()[0];
  const buois = tu
    ? await db.buoi_hoc.findMany({
        where: { mon_id: { in: mons.map((m) => m.id) }, ngay: { gte: s2d(tu), lte: s2d(congNgay(h, 6)) } },
        orderBy: { bat_dau_luc: "asc" },
        include: { diem_danh: { where: { hoc_sinh_id: u.hocSinhId }, select: { trang_thai: true } } },
      })
    : [];
  return {
    hom_nay: h,
    hoc_sinh: hs,
    tinh_trang: tinhTrang(gds, h),
    mon: mons.map((m) => ({
      ma: m.ma, ten: m.ten_ngan, o: oMon(gds, m.id, h), con_han: conHan(gds, m.id, h),
      ghi_danh: gds.filter((g) => g.mon_id === m.id && !g.huy).map((g) => ({ loai: g.loai, tu_ngay: g.tu, den_ngay: g.den })),
    })),
    buoi: buois
      .filter((b) => loaiVaoNgay(gds, b.mon_id, d2s(b.ngay)))
      .map((b) => {
        const xem = conHan(gds, b.mon_id, h);
        return {
          id: b.id, mon: mons.find((m) => m.id === b.mon_id)!.ma, ngay: d2s(b.ngay), gio: gioVN(b.bat_dau_luc), loai: b.loai,
          trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy,
          diem_danh: b.trang_thai === "huy" ? null : (b.diem_danh[0]?.trang_thai ?? null),
          noi_dung: xem ? b.noi_dung : null, link_record: xem ? b.link_record : null, khoa: !xem,
        };
      }),
  };
}

export async function buoiCuaToi(u: Nguoi, buoiId: number, luc = new Date()) {
  canHocSinh(u);
  const b = await db.buoi_hoc.findUnique({ where: { id: buoiId }, include: { mon: true } });
  const gds = (await napGD({ hoc_sinh_id: u.hocSinhId })).get(u.hocSinhId) ?? [];
  if (!b || !loaiVaoNgay(gds, b.mon_id, d2s(b.ngay))) throw new LoiQuyen("Buổi này không thuộc lớp của em");
  if (!conHan(gds, b.mon_id, ngayVN(luc))) throw new LoiDuLieu("Em đã hết hạn học môn này — liên hệ gia hạn", 403, "het_han");
  const dd = await db.diem_danh.findUnique({ where: { buoi_id_hoc_sinh_id: { buoi_id: b.id, hoc_sinh_id: u.hocSinhId } }, select: { trang_thai: true } });
  return {
    id: b.id, mon: b.mon.ten_ngan, ngay: d2s(b.ngay), gio: gioVN(b.bat_dau_luc), so_phut: b.so_phut, loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy,
    noi_dung: b.noi_dung, link_record: b.link_record, diem_danh: dd?.trang_thai ?? null,
  };
}
