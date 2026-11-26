// Buổi học (buoi-hoc.md). Sinh / huỷ / học bù: chỉ chủ (T9). Nội dung + record: chủ + GV môn.
import { d2s, gioVN, lucVN, ngayTrongThang, s2d } from "@/lib/ngay";
import { canChu, canMon, canQuanLy, LoiDuLieu, monXemDuoc, type Nguoi } from "@/lib/quyen";
import { buoiTheoLich, chuanHoaLink, hieuLuc } from "@/lib/quy-tac";
import { db } from "./db";
import { caiDat, napGD } from "./du-lieu";
import { ghiNhatKy } from "./nhat-ky";
import { tienDo } from "./diem-danh";

export async function danhSachBuoi(u: Nguoi, opt: { thang: string; mon?: string }) {
  canQuanLy(u);
  const ngays = ngayTrongThang(opt.thang);
  const monIds = monXemDuoc(u);
  const mon = opt.mon ? await db.mon.findUnique({ where: { ma: opt.mon } }) : null;
  if (opt.mon && !mon) throw new LoiDuLieu(`Không có môn ${opt.mon}`, 404);
  if (mon) canMon(u, mon.id);
  const buois = await db.buoi_hoc.findMany({
    where: { ngay: { gte: s2d(ngays[0]), lte: s2d(ngays.at(-1)!) }, ...(mon ? { mon_id: mon.id } : monIds ? { mon_id: { in: monIds } } : {}) },
    orderBy: { bat_dau_luc: "asc" },
    include: { mon: { select: { ma: true, ten_ngan: true } } },
  });
  const td = await tienDo(buois);
  return {
    thang: opt.thang,
    buoi: buois.map((b) => ({
      id: b.id, ngay: d2s(b.ngay), gio: gioVN(b.bat_dau_luc), bat_dau_luc: b.bat_dau_luc, so_phut: b.so_phut, mon: { ma: b.mon.ma, ten: b.mon.ten_ngan },
      loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy, bu_cho_buoi_id: b.bu_cho_buoi_id,
      noi_dung: b.noi_dung, link_record: b.link_record, ghi_chu: b.ghi_chu, da_diem_danh_luc: b.da_diem_danh_luc, tien_do: td.get(b.id),
    })),
  };
}

/** buoi-hoc.md 3.1–3.2: sinh buổi theo lịch, lặp lại an toàn (bỏ qua khoá trùng môn + giờ bắt đầu). */
export async function sinhBuoiThang(u: Nguoi, thang: string) {
  canChu(u);
  const [mons, cd] = await Promise.all([db.mon.findMany(), caiDat()]);
  const ds = buoiTheoLich(mons, thang, cd.NGAY_BAT_DAU_TINH_PHI);
  const r = await db.buoi_hoc.createMany({ data: ds.map((b) => ({ ...b, ngay: s2d(b.ngay) })), skipDuplicates: true });
  await ghiNhatKy(u, "sinh_buoi", "thang", thang, null, { theo_lich: ds.length, tao_moi: r.count });
  return { theo_lich: ds.length, tao_moi: r.count };
}

/** buoi-hoc.md Điều 6: huỷ có lý do; buổi đã có điểm danh phải xác nhận lần nữa. */
export async function huyBuoi(u: Nguoi, id: number, lyDo: string, xacNhan = false) {
  canChu(u);
  if (!lyDo?.trim()) throw new LoiDuLieu("Cần ghi lý do huỷ buổi");
  const b = await db.buoi_hoc.findUnique({ where: { id }, include: { _count: { select: { diem_danh: true } } } });
  if (!b) throw new LoiDuLieu("Không có buổi này", 404);
  if (b.trang_thai === "huy") throw new LoiDuLieu("Buổi đã huỷ", 409);
  if (b._count.diem_danh > 0 && !xacNhan)
    throw new LoiDuLieu(`Buổi đã có ${b._count.diem_danh} bản ghi điểm danh — cần xác nhận để huỷ (điểm danh vẫn giữ)`, 409, "can_xac_nhan");
  const r = await db.buoi_hoc.update({ where: { id }, data: { trang_thai: "huy", ly_do_huy: lyDo.trim() } });
  await ghiNhatKy(u, "huy_buoi", "buoi_hoc", id, { trang_thai: b.trang_thai }, { trang_thai: "huy", ly_do_huy: r.ly_do_huy });
  return { id, trang_thai: r.trang_thai };
}

export async function boHuyBuoi(u: Nguoi, id: number) {
  canChu(u);
  const b = await db.buoi_hoc.findUnique({ where: { id } });
  if (!b) throw new LoiDuLieu("Không có buổi này", 404);
  if (b.trang_thai !== "huy") throw new LoiDuLieu("Buổi không ở trạng thái huỷ", 409);
  await db.buoi_hoc.update({ where: { id }, data: { trang_thai: "binh_thuong", ly_do_huy: null } });
  await ghiNhatKy(u, "bo_huy_buoi", "buoi_hoc", id, { trang_thai: "huy", ly_do_huy: b.ly_do_huy }, { trang_thai: "binh_thuong" });
  return { id, trang_thai: "binh_thuong" };
}

/** buoi-hoc.md Điều 7: học bù; chồng giờ thì cảnh báo (không chặn) kèm số em học cả hai môn. */
export async function themHocBu(u: Nguoi, v: { mon: string; ngay: string; gio?: string; soPhut?: number; buChoBuoiId?: number; ghiChu?: string }) {
  canChu(u);
  const mon = await db.mon.findUnique({ where: { ma: v.mon } });
  if (!mon) throw new LoiDuLieu(`Không có môn ${v.mon}`, 404);
  const gio = v.gio ?? "22:15";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)) throw new LoiDuLieu("Giờ phải dạng HH:MM");
  const soPhut = v.soPhut ?? 90;
  if (!Number.isInteger(soPhut) || soPhut < 15 || soPhut > 300) throw new LoiDuLieu("Số phút 15–300");
  if (v.buChoBuoiId) {
    const goc = await db.buoi_hoc.findUnique({ where: { id: v.buChoBuoiId } });
    if (!goc || goc.mon_id !== mon.id) throw new LoiDuLieu("Buổi được bù không cùng môn hoặc không tồn tại");
  }
  const batDau = lucVN(v.ngay, gio);
  if (await db.buoi_hoc.findUnique({ where: { mon_id_bat_dau_luc: { mon_id: mon.id, bat_dau_luc: batDau } } }))
    throw new LoiDuLieu("Đã có buổi môn này đúng giờ đó", 409);
  const b = await db.buoi_hoc.create({
    data: { mon_id: mon.id, ngay: s2d(v.ngay), bat_dau_luc: batDau, so_phut: soPhut, loai: "hoc_bu", bu_cho_buoi_id: v.buChoBuoiId ?? null, ghi_chu: v.ghiChu?.trim() || null },
  });
  await ghiNhatKy(u, "them_hoc_bu", "buoi_hoc", b.id, null, { mon: v.mon, ngay: v.ngay, gio, so_phut: soPhut, bu_cho_buoi_id: v.buChoBuoiId ?? null });
  // Cảnh báo chồng giờ (7.3)
  const ketThuc = batDau.getTime() + soPhut * 60_000;
  const cungNgay = await db.buoi_hoc.findMany({ where: { ngay: s2d(v.ngay), trang_thai: "binh_thuong", id: { not: b.id } }, include: { mon: true } });
  const chong = cungNgay.filter((x) => x.bat_dau_luc.getTime() < ketThuc && batDau.getTime() < x.bat_dau_luc.getTime() + x.so_phut * 60_000);
  const canhBao = [];
  if (chong.length) {
    const gdMap = await napGD({ mon_id: { in: [mon.id, ...chong.map((x) => x.mon_id)] } });
    for (const x of chong) {
      let n = 0;
      for (const gds of gdMap.values()) if (gds.some((g) => g.mon_id === mon.id && hieuLuc(g, v.ngay)) && gds.some((g) => g.mon_id === x.mon_id && hieuLuc(g, v.ngay))) n++;
      canhBao.push(`Trùng giờ ${x.mon.ten_ngan} ${gioVN(x.bat_dau_luc)}, ${n} em học cả hai môn`);
    }
  }
  return { id: b.id, canh_bao: canhBao };
}

/** buoi-hoc.md Điều 8: nội dung ≤ 2000 ký tự, link record https. Chủ + GV môn (kể cả sau buổi). */
export async function suaNoiDungBuoi(u: Nguoi, id: number, v: { noiDung?: string | null; linkRecord?: string | null }) {
  canQuanLy(u);
  const b = await db.buoi_hoc.findUnique({ where: { id } });
  if (!b) throw new LoiDuLieu("Không có buổi này", 404);
  canMon(u, b.mon_id);
  const data: { noi_dung?: string | null; link_record?: string | null } = {};
  if (v.noiDung !== undefined) {
    const s = v.noiDung?.trim() || null;
    if (s && s.length > 2000) throw new LoiDuLieu("Nội dung buổi tối đa 2.000 ký tự");
    data.noi_dung = s;
  }
  if (v.linkRecord !== undefined) {
    if (v.linkRecord && !v.linkRecord.trim()) data.link_record = null;
    else if (v.linkRecord) {
      const l = chuanHoaLink(v.linkRecord);
      if (!l) throw new LoiDuLieu("Link record không phải địa chỉ web", 400, "link_sai");
      data.link_record = l;
    } else data.link_record = null;
  }
  const r = await db.buoi_hoc.update({ where: { id }, data });
  await ghiNhatKy(u, "sua_noi_dung_buoi", "buoi_hoc", id, { noi_dung: b.noi_dung, link_record: b.link_record }, { noi_dung: r.noi_dung, link_record: r.link_record });
  return { id, noi_dung: r.noi_dung, link_record: r.link_record };
}
