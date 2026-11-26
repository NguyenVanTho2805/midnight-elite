// Khu học sinh (dữ liệu cho Đợt 2). Học sinh CHỈ đọc dữ liệu của chính mình (phan-quyen.md 4.3).
// Nội dung buổi + record: chỉ khi em đang có ghi danh môn đó còn hạn hôm nay VÀ có tên ở ngày buổi (QĐ 8, T16, T32).
// Ghi chú điểm danh (T25) không bao giờ trả cho học sinh.
import { congNgay, d2s, gioVN, ngayVN, s2d, soNgayGiua } from "@/lib/ngay";
import { LoiDuLieu, LoiQuyen, type Nguoi, type NguoiHocSinh } from "@/lib/quyen";
import { conMo, hanThuChung, hetThu, hieuLuc, loaiVaoNgay, oMon, tinhTrang, type GD } from "@/lib/quy-tac";
import { db } from "./db";
import { napGD, napMon } from "./du-lieu";

function canHocSinh(u: Nguoi): asserts u is NguoiHocSinh {
  if (u.vai !== "hoc_sinh") throw new LoiQuyen("Khu này dành cho học sinh");
}
/** Chỉ trả link http(s) cho học sinh (dữ liệu chuyển từ sheet có thể là chữ tuỳ ý — chặn "javascript:" và chữ rác). */
const linkAnToan = (l: string | null | undefined) => (l && /^https?:\/\/[^\s]+$/i.test(l.trim()) ? l.trim() : null);
const conHan = (gds: GD[], monId: number, h: string) => gds.some((g) => g.mon_id === monId && hieuLuc(g, h));

type BuoiChuoi = { bat_dau: string; so_phut: number; trang_thai: string; diem_danh: string | null };
/**
 * Chuỗi buổi đi học liên tiếp (huong-chon sửa 5), tính lùi từ buổi đã kết thúc gần nhất (buổi sắp xếp tăng dần theo giờ):
 * Có mặt +1; Phép, buổi chưa có dấu, buổi lớp nghỉ không làm đứt; Vắng làm đứt.
 */
export function chuoiDiHoc(buoi: BuoiChuoi[], luc: Date) {
  let n = 0;
  for (const b of [...buoi].reverse()) {
    if (b.trang_thai === "huy" || Date.parse(b.bat_dau) + b.so_phut * 60_000 > luc.getTime()) continue;
    if (b.diem_danh === "vang") break;
    if (b.diem_danh === "co") n++;
  }
  return n;
}

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
  const lienHe = Object.fromEntries(
    (await db.cai_dat.findMany({ where: { khoa: { in: ["ZALO_HOC_THU", "ZALO_CHUNG"] } } }))
      .map((r) => [r.khoa, typeof r.gia_tri === "string" ? linkAnToan(r.gia_tri) : null]),
  );
  const s = gds.filter((g) => !g.huy);
  const denThu = hanThuChung(gds, h);
  const dangCT = s.some((g) => g.loai === "chinh_thuc" && hieuLuc(g, h));
  const tuThu = s.filter((g) => g.loai === "thu" && hieuLuc(g, h)).map((g) => g.tu).sort()[0];
  const het = hetThu(gds, h);
  const batDau = s.filter((g) => g.tu > h).map((g) => g.tu).sort()[0] ?? null;
  // Trạng thái cho chính em (không dùng chuỗi tinh_trang của chủ — có câu "hỏi em").
  const trangThai = dangCT ? "dang_hoc" : denThu ? "dang_thu" : batDau ? "sap_bat_dau" : !s.length ? "chua_ghi_danh" : het ? "het_thu" : "da_nghi";
  const ra = buois
    .filter((b) => loaiVaoNgay(gds, b.mon_id, d2s(b.ngay)))
    .map((b) => {
      const xem = conHan(gds, b.mon_id, h);
      return {
        id: b.id, mon: mons.find((m) => m.id === b.mon_id)!.ma, ngay: d2s(b.ngay), gio: gioVN(b.bat_dau_luc), bat_dau: b.bat_dau_luc.toISOString(), so_phut: b.so_phut, loai: b.loai,
        trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy,
        diem_danh: b.trang_thai === "huy" ? null : (b.diem_danh[0]?.trang_thai ?? null),
        noi_dung: xem ? b.noi_dung : null, link_record: xem ? linkAnToan(b.link_record) : null, khoa: !xem,
      };
    });
  const chuoi = chuoiDiHoc(ra, luc);
  return {
    hom_nay: h,
    hoc_sinh: hs,
    tinh_trang: tinhTrang(gds, h).replace(/ – hỏi em$/, ""), // câu "hỏi em" dành cho chủ
    trang_thai: trangThai,
    thu: denThu && !dangCT ? { tu: tuThu, den: denThu, con_ngay: soNgayGiua(h, denThu), ngay_thu: soNgayGiua(tuThu, h) + 1, tong_ngay: soNgayGiua(tuThu, denThu) + 1 } : null,
    het_thu: het,
    bat_dau: batDau,
    chuoi,
    lien_he: { zalo_hoc_thu: lienHe.ZALO_HOC_THU ?? null, zalo_chung: lienHe.ZALO_CHUNG ?? null },
    mon: mons.map((m) => {
      const ch = conHan(gds, m.id, h);
      return {
        ma: m.ma, ten: m.ten_ngan, ten_day_du: m.ten_day_du, thu: m.thu, gio: m.gio_bat_dau, so_phut: m.so_phut,
        o: oMon(gds, m.id, h), con_han: ch, dang_mo: s.some((g) => g.mon_id === m.id && conMo(g, h)),
        // Link nhóm/Meet chỉ khi em còn hạn môn đó hôm nay (QĐ 8, T16).
        link_meet: ch ? linkAnToan(m.link_meet) : null, link_zalo: ch ? linkAnToan(m.link_zalo) : null,
        ghi_danh: gds.filter((g) => g.mon_id === m.id && !g.huy).map((g) => ({ loai: g.loai, tu_ngay: g.tu, den_ngay: g.den })),
      };
    }),
    buoi: ra,
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
    noi_dung: b.noi_dung, link_record: linkAnToan(b.link_record), diem_danh: dd?.trang_thai ?? null,
  };
}
