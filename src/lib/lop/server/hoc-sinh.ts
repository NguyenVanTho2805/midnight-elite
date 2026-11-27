// Danh sách + chi tiết học sinh cho khu quản lý (chép phần ĐỌC từ bca/server/hoc-sinh.ts). Cột chọn theo vai (lib/lop/quyen.ts).
// Bước 4 bỏ ra: đơn giá (caiDat — phần học phí chờ chủ, README mục 6.4) và ngày mặc định của các nút ghi (bước 5 thêm lại).
import { d2s, ngayTrongThang, ngayVN, soNgayGiua, thangCua } from "../ngay";
import { canQuanLy, cotHocSinh, laChu, LoiDuLieu, monXemDuoc, type Nguoi } from "../quyen";
import { chuoi, conMo, demDD, hanThuChung, hetThu, hieuLuc, oMon, tinhTrang, type GD } from "../quy-tac";
import { soTenViet } from "../chuan-hoa";
import { prisma as db } from "@/lib/prisma";
import { napGD, napMon } from "./du-lieu";

function oTheoMon(gds: GD[], mons: { id: number; ma: string }[], h: string) {
  return Object.fromEntries(mons.map((m) => [m.ma, oMon(gds, m.id, h)]));
}
const thuVao = (gds: GD[], h: string) => {
  const den = hanThuChung(gds, h);
  if (!den) return null;
  const tu = gds.filter((g) => g.loai === "thu" && hieuLuc(g, h)).map((g) => g.tu).sort()[0];
  return { tu, den, con_ngay: soNgayGiua(h, den), ngay_thu: soNgayGiua(tu, h) + 1, tong_ngay: soNgayGiua(tu, den) + 1 };
};

/**
 * Ngày hết thử của em theo đúng cách màn Hôm nay nhóm việc: đang thử (chưa có Chính thức còn mở) ⇒ hạn thử chung (nhóm "Thử sắp hết");
 * đã hết thử ⇒ ngày hết (nhóm "Hết thử – hỏi em"). Không thuộc nhóm nào ⇒ null.
 */
export const ngayHetThu = (gds: GD[], h: string) =>
  gds.some((g) => g.loai === "chinh_thuc" && conMo(g, h)) ? null : (hanThuChung(gds, h) ?? hetThu(gds, h));

/** `hetNgay` (YYYY-MM-DD): chỉ em có ngayHetThu đúng ngày đó — nút "Xem N em ›" ở Hôm nay mở đúng nhóm (mục 22). */
export async function danhSachHocSinh(u: Nguoi, opt: { coAn?: boolean; hetNgay?: string } = {}, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const monIds = monXemDuoc(u);
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const rows = await db.bcaHocSinh.findMany({
    where: { ...(opt.coAn && laChu(u) ? {} : { an_luc: null }), ...(monIds ? { ghi_danh: { some: { mon_id: { in: monIds } } } } : {}) },
    select: cotHocSinh(u),
  });
  const gdMap = await napGD({ hoc_sinh_id: { in: rows.map((r) => r.id) }, ...(monIds ? { mon_id: { in: monIds } } : {}) });
  return {
    hom_nay: h,
    mon: mons.map((m) => ({ ma: m.ma, ten: m.ten_ngan })),
    hoc_sinh: rows
      .filter((r) => !opt.hetNgay || ngayHetThu(gdMap.get(r.id) ?? [], h) === opt.hetNgay)
      .map((r) => {
        const gds = gdMap.get(r.id) ?? [];
        return { ...r, mon: oTheoMon(gds, mons, h), tinh_trang: tinhTrang(gds, h), thu: thuVao(gds, h), dang_ky: gds[0]?.tu ?? null };
      })
      .sort((a, b) => soTenViet(a.ho_ten, b.ho_ten)),
  };
}

export async function chiTietHocSinh(u: Nguoi, maHs: string, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const monIds = monXemDuoc(u);
  const hs = await db.bcaHocSinh.findFirst({
    where: { ma_hs: maHs, ...(monIds ? { ghi_danh: { some: { mon_id: { in: monIds } } } } : {}) },
    select: cotHocSinh(u),
  });
  if (!hs) throw new LoiDuLieu(`Không có học sinh ${maHs}`, 404); // GV: em không thuộc môn mình cũng là 404
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const gds = (await napGD({ hoc_sinh_id: hs.id, ...(monIds ? { mon_id: { in: monIds } } : {}) })).get(hs.id) ?? [];

  // GV chỉ thấy thay đổi của chính mình (phan-quyen.md Điều 3): u.id là bca_nguoi_dung.id (nguoiLopBca) nên so được với cột uuid.
  const lichSu = await db.bcaNhatKy.findMany({
    where: { doi_tuong: "ghi_danh", doi_tuong_id: { in: gds.map((g) => String(g.id)) }, ...(laChu(u) ? {} : { nguoi_dung_id: u.id }) },
    orderBy: { luc: "asc" },
  });
  const tenNguoi = await tenNguoiDung(lichSu.map((l) => l.nguoi_dung_id));

  const thang = thangCua(h);
  const ngays = ngayTrongThang(thang);
  const buois = await db.bcaBuoiHoc.findMany({
    where: { mon_id: { in: mons.map((m) => m.id) }, ngay: { gte: new Date(`${ngays[0]}T00:00:00Z`), lte: new Date(`${ngays.at(-1)}T00:00:00Z`) } },
    orderBy: { bat_dau_luc: "asc" },
    include: { diem_danh: { where: { hoc_sinh_id: hs.id }, select: { trang_thai: true } } },
  });

  return {
    hom_nay: h,
    hoc_sinh: hs,
    tinh_trang: tinhTrang(gds, h),
    thu: thuVao(gds, h),
    mon: mons.map((m) => {
      const cua = gds.filter((g) => g.mon_id === m.id);
      const bs = buois.filter((b) => b.mon_id === m.id).map((b) => {
        const ngay = d2s(b.ngay);
        const coTen = cua.some((g) => hieuLuc(g, ngay));
        return { buoi_id: b.id, ngay, huy: b.trang_thai === "huy", co_ten: coTen, trang_thai: b.trang_thai === "huy" || !coTen ? null : (b.diem_danh[0]?.trang_thai ?? null) };
      });
      const tt = bs.map((b) => b.trang_thai);
      return {
        ma: m.ma, ten: m.ten_ngan, o: oMon(gds, m.id, h),
        ghi_danh: cua.map((g) => ({ id: g.id, ma_gd: g.ma_gd, loai: g.loai, tu_ngay: g.tu, den_ngay: g.den, huy: g.huy, nghi: !!g.nghi })),
        lich_su: lichSu.filter((l) => cua.some((g) => String(g.id) === l.doi_tuong_id)).map((l) => ({ luc: l.luc, ai: tenNguoi.get(l.nguoi_dung_id ?? "") ?? "Hệ thống", hanh_dong: l.hanh_dong, truoc: l.truoc, sau: l.sau })),
        chuyen_can: { thang, buoi: bs, ...demDD(tt), chuoi: chuoi(tt) },
      };
    }),
    ...(laChu(u)
      ? {
          don: await db.bcaDonDangKy.findMany({ where: { hoc_sinh_id: hs.id }, orderBy: { thoi_gian: "desc" }, select: { thoi_gian: true, loai: true, nguon: true, biet_qua: true, trang_thai: true } }),
        }
      : {}),
  };
}

export async function tenNguoiDung(ids: (string | null)[]) {
  const ds = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = ds.length ? await db.bcaNguoiDung.findMany({ where: { id: { in: ds } }, select: { id: true, ten_hien_thi: true } }) : [];
  return new Map(rows.map((r) => [r.id, r.ten_hien_thi]));
}

