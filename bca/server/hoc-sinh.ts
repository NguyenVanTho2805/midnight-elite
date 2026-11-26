// Danh sách + chi tiết học sinh cho khu quản lý. Cột chọn theo vai (lib/quyen.ts).
import { d2s, ngayTrongThang, ngayVN, s2d, soNgayGiua, thangCua } from "@/lib/ngay";
import { canChu, canQuanLy, cotHocSinh, laChu, LoiDuLieu, monXemDuoc, type Nguoi } from "@/lib/quyen";
import { chuoi, demDD, hanThuChung, hieuLuc, ngayChinhThucMacDinh, ngayNghiMacDinh, oMon, tinhTrang, type GD } from "@/lib/quy-tac";
import { catKhoangTrang, chuanHoaGmail, chuanHoaSdt, goiYGmail, soTenViet } from "@/lib/chuan-hoa";
import { db } from "./db";
import { capMa, napGD, napMon } from "./du-lieu";
import { ghiNhatKy } from "./nhat-ky";

function oTheoMon(gds: GD[], mons: { id: number; ma: string }[], h: string) {
  return Object.fromEntries(mons.map((m) => [m.ma, oMon(gds, m.id, h)]));
}
const thuVao = (gds: GD[], h: string) => {
  const den = hanThuChung(gds, h);
  if (!den) return null;
  const tu = gds.filter((g) => g.loai === "thu" && hieuLuc(g, h)).map((g) => g.tu).sort()[0];
  return { tu, den, con_ngay: soNgayGiua(h, den), ngay_thu: soNgayGiua(tu, h) + 1, tong_ngay: soNgayGiua(tu, den) + 1 };
};

export async function danhSachHocSinh(u: Nguoi, opt: { coAn?: boolean } = {}, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const monIds = monXemDuoc(u);
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const rows = await db.hoc_sinh.findMany({
    where: { ...(opt.coAn && laChu(u) ? {} : { an_luc: null }), ...(monIds ? { ghi_danh: { some: { mon_id: { in: monIds } } } } : {}) },
    select: cotHocSinh(u),
  });
  const gdMap = await napGD({ hoc_sinh_id: { in: rows.map((r) => r.id) }, ...(monIds ? { mon_id: { in: monIds } } : {}) });
  return {
    hom_nay: h,
    mon: mons.map((m) => ({ ma: m.ma, ten: m.ten_ngan })),
    hoc_sinh: rows
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
  const hs = await db.hoc_sinh.findFirst({
    where: { ma_hs: maHs, ...(monIds ? { ghi_danh: { some: { mon_id: { in: monIds } } } } : {}) },
    select: cotHocSinh(u),
  });
  if (!hs) throw new LoiDuLieu(`Không có học sinh ${maHs}`, 404); // GV: em không thuộc môn mình cũng là 404
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const gds = (await napGD({ hoc_sinh_id: hs.id, ...(monIds ? { mon_id: { in: monIds } } : {}) })).get(hs.id) ?? [];

  const lichSu = await db.nhat_ky.findMany({
    where: { doi_tuong: "ghi_danh", doi_tuong_id: { in: gds.map((g) => String(g.id)) }, ...(laChu(u) ? {} : { nguoi_dung_id: u.id }) },
    orderBy: { luc: "asc" },
  });
  const tenNguoi = await tenNguoiDung(lichSu.map((l) => l.nguoi_dung_id));

  const thang = thangCua(h);
  const ngays = ngayTrongThang(thang);
  const buois = await db.buoi_hoc.findMany({
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
        ...(laChu(u) ? { mac_dinh_chinh_thuc: ngayChinhThucMacDinh(gds, m.id, h) } : {}),
      };
    }),
    ...(laChu(u)
      ? {
          mac_dinh_nghi: ngayNghiMacDinh(luc),
          don: await db.don_dang_ky.findMany({ where: { hoc_sinh_id: hs.id }, orderBy: { thoi_gian: "desc" }, select: { thoi_gian: true, loai: true, nguon: true, biet_qua: true, trang_thai: true } }),
        }
      : {}),
  };
}

export async function tenNguoiDung(ids: (string | null)[]) {
  const ds = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = ds.length ? await db.nguoi_dung.findMany({ where: { id: { in: ds } }, select: { id: true, ten_hien_thi: true } }) : [];
  return new Map(rows.map((r) => [r.id, r.ten_hien_thi]));
}

export type HoSoMoi = {
  hoTen: string; ngayTao?: string; sdtHs?: string; sdtPh?: string; gmail?: string; hoTenPh?: string; truong?: string; khoi?: string;
  mucTieu?: string; nguon?: string; usernameAzota?: string; ghiChu?: string; ghiChuRieng?: string; dongYVinhDanh?: boolean;
};
/** ghi-danh.md Điều 1–2 — chủ tạo hồ sơ tay: mã mới không cấp lại, chuẩn hoá SĐT/Gmail, lứa theo ngày tạo. Trùng SĐT chỉ cảnh báo. */
export async function taoHocSinh(u: Nguoi, v: HoSoMoi, luc = new Date()) {
  canChu(u);
  const ho_ten = catKhoangTrang(v.hoTen);
  if (!ho_ten) throw new LoiDuLieu("Cần họ tên");
  const ngay_tao = v.ngayTao ?? ngayVN(luc);
  const gmail = chuanHoaGmail(v.gmail), sdt_hs = chuanHoaSdt(v.sdtHs), sdt_ph = chuanHoaSdt(v.sdtPh), username_azota = catKhoangTrang(v.usernameAzota);
  return db.$transaction(async (tx) => {
    const trungGmail = gmail && (await tx.hoc_sinh.findUnique({ where: { gmail }, select: { ma_hs: true } }));
    if (trungGmail) throw new LoiDuLieu(`Gmail đã có ở ${trungGmail.ma_hs}`, 409, "trung_gmail");
    const trungAzota = username_azota && (await tx.hoc_sinh.findUnique({ where: { username_azota }, select: { ma_hs: true } }));
    if (trungAzota) throw new LoiDuLieu(`Username Azota đã có ở ${trungAzota.ma_hs}`, 409, "trung_azota");
    const lua = await tx.lua.findFirst({ where: { tu_ngay: { lte: s2d(ngay_tao) }, OR: [{ den_ngay: null }, { den_ngay: { gte: s2d(ngay_tao) } }] }, orderBy: { tu_ngay: "desc" } });
    const hs = await tx.hoc_sinh.create({
      data: {
        ma_hs: await capMa(tx, "hs"), ho_ten, ngay_tao: s2d(ngay_tao), lua_id: lua?.id ?? null, gmail, sdt_hs, sdt_ph, username_azota,
        ho_ten_ph: catKhoangTrang(v.hoTenPh), truong: catKhoangTrang(v.truong), khoi: catKhoangTrang(v.khoi), muc_tieu: catKhoangTrang(v.mucTieu),
        nguon: catKhoangTrang(v.nguon) ?? "Chủ thêm tay", ghi_chu: catKhoangTrang(v.ghiChu), ghi_chu_rieng: catKhoangTrang(v.ghiChuRieng), dong_y_vinh_danh: v.dongYVinhDanh === true,
      },
    });
    const sdts = [sdt_hs, sdt_ph].filter((x): x is string => !!x);
    const trungSdt = sdts.length
      ? await tx.hoc_sinh.findMany({ where: { id: { not: hs.id }, OR: [{ sdt_hs: { in: sdts } }, { sdt_ph: { in: sdts } }] }, select: { ma_hs: true } })
      : [];
    await ghiNhatKy(u, "tao_hoc_sinh", "hoc_sinh", hs.ma_hs, null, { ma_hs: hs.ma_hs, lua_id: hs.lua_id, ngay_tao, nguon: hs.nguon }, tx);
    return { ma_hs: hs.ma_hs, lua: lua?.ma ?? null, sdt_hs, sdt_ph, goi_y_gmail: goiYGmail(gmail), trung_sdt: trungSdt.map((x) => x.ma_hs) };
  });
}
