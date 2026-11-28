// Buổi học (buoi-hoc.md) — chép từ bca/server/buoi-hoc.ts. Huỷ / học bù / xoá / sinh buổi còn thiếu: chỉ chủ (T9). Nội dung + record: chủ + GV môn.
// Bước 5 KHÔNG chép: "Sinh buổi tháng" (sinhBuoiThang) và đổi lịch môn (doiLichMon) — ngoài phạm vi bước này.
import { prisma as db } from "@/lib/prisma";
import { d2s, gioVN, lucVN, ngayTrongThang, s2d } from "../ngay";
import { canChu, canMon, canQuanLy, LoiDuLieu, monXemDuoc, type Nguoi } from "../quyen";
import { buoiTheoLich, chuanHoaLink, conHanHoanTac, hieuLuc } from "../quy-tac";
import { giaoVienTheoMon, khoaBuoi, napGD, ngayBatDauLop } from "./du-lieu";
import { ghiNhatKy, khoaNhatKy } from "./nhat-ky";
import { tienDo } from "./diem-danh";

export async function danhSachBuoi(u: Nguoi, opt: { thang: string; mon?: string }) {
  canQuanLy(u);
  const ngays = ngayTrongThang(opt.thang);
  const monIds = monXemDuoc(u);
  const mon = opt.mon ? await db.bcaMon.findUnique({ where: { ma: opt.mon } }) : null;
  if (opt.mon && !mon) throw new LoiDuLieu(`Không có môn ${opt.mon}`, 404);
  if (mon) canMon(u, mon.id);
  const buois = await db.bcaBuoiHoc.findMany({
    where: { ngay: { gte: s2d(ngays[0]), lte: s2d(ngays.at(-1)!) }, ...(mon ? { mon_id: mon.id } : monIds ? { mon_id: { in: monIds } } : {}) },
    orderBy: { bat_dau_luc: "asc" },
    include: { mon: { select: { ma: true, ten_ngan: true, ten_day_du: true, link_meet: true } } },
  });
  const [td, gv] = await Promise.all([tienDo(buois), giaoVienTheoMon([...new Set(buois.map((b) => b.mon_id))])]);
  return {
    thang: opt.thang,
    buoi: buois.map((b) => ({
      id: b.id, ngay: d2s(b.ngay), gio: gioVN(b.bat_dau_luc), bat_dau_luc: b.bat_dau_luc, so_phut: b.so_phut, mon: { ma: b.mon.ma, ten: b.mon.ten_ngan, ten_day_du: b.mon.ten_day_du, link_meet: b.mon.link_meet, giao_vien: gv.get(b.mon_id) ?? [] },
      loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy, bu_cho_buoi_id: b.bu_cho_buoi_id,
      noi_dung: b.noi_dung, link_record: b.link_record, ghi_chu: b.ghi_chu, da_diem_danh_luc: b.da_diem_danh_luc, tien_do: td.get(b.id),
    })),
  };
}

/** buoi-hoc.md Điều 6: huỷ có lý do; buổi đã có điểm danh phải xác nhận lần nữa. */
export async function huyBuoi(u: Nguoi, id: number, lyDo: string, xacNhan = false) {
  canChu(u);
  if (!lyDo?.trim()) throw new LoiDuLieu("Cần ghi lý do huỷ buổi");
  if (lyDo.length > 300) throw new LoiDuLieu("Lý do huỷ tối đa 300 ký tự");
  return db.$transaction(async (tx) => {
    await khoaBuoi(tx, id);
    const b = await tx.bcaBuoiHoc.findUnique({ where: { id }, include: { _count: { select: { diem_danh: true } } } });
    if (!b) throw new LoiDuLieu("Không có buổi này", 404);
    if (b.trang_thai === "huy") throw new LoiDuLieu("Buổi đã huỷ", 409);
    if (b._count.diem_danh > 0 && !xacNhan)
      throw new LoiDuLieu(`Buổi đã có ${b._count.diem_danh} bản ghi điểm danh — cần xác nhận để huỷ (điểm danh vẫn giữ)`, 409, "can_xac_nhan");
    const r = await tx.bcaBuoiHoc.update({ where: { id }, data: { trang_thai: "huy", ly_do_huy: lyDo.trim() } });
    await ghiNhatKy(u, "huy_buoi", "buoi_hoc", id, { trang_thai: b.trang_thai }, { trang_thai: "huy", ly_do_huy: r.ly_do_huy }, tx);
    return { id, trang_thai: r.trang_thai };
  });
}

export async function boHuyBuoi(u: Nguoi, id: number) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaBuoi(tx, id);
    const b = await tx.bcaBuoiHoc.findUnique({ where: { id } });
    if (!b) throw new LoiDuLieu("Không có buổi này", 404);
    if (b.trang_thai !== "huy") throw new LoiDuLieu("Buổi không ở trạng thái huỷ", 409);
    await tx.bcaBuoiHoc.update({ where: { id }, data: { trang_thai: "binh_thuong", ly_do_huy: null } });
    await ghiNhatKy(u, "bo_huy_buoi", "buoi_hoc", id, { trang_thai: "huy", ly_do_huy: b.ly_do_huy }, { trang_thai: "binh_thuong" }, tx);
    return { id, trang_thai: "binh_thuong" };
  });
}

/** buoi-hoc.md Điều 7: học bù; chồng giờ thì cảnh báo (không chặn) kèm số em học cả hai môn. */
export async function themHocBu(u: Nguoi, v: { mon: string; ngay: string; gio?: string; soPhut?: number; buChoBuoiId?: number; ghiChu?: string }) {
  canChu(u);
  const mon = await db.bcaMon.findUnique({ where: { ma: v.mon } });
  if (!mon) throw new LoiDuLieu(`Không có môn ${v.mon}`, 404);
  const gio = v.gio ?? "22:15";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)) throw new LoiDuLieu("Giờ phải dạng HH:MM");
  const soPhut = v.soPhut ?? 90;
  if (!Number.isInteger(soPhut) || soPhut < 15 || soPhut > 300) throw new LoiDuLieu("Số phút 15–300");
  if (v.buChoBuoiId) {
    const goc = await db.bcaBuoiHoc.findUnique({ where: { id: v.buChoBuoiId } });
    if (!goc || goc.mon_id !== mon.id) throw new LoiDuLieu("Buổi được bù không cùng môn hoặc không tồn tại");
  }
  if ((v.ghiChu?.length ?? 0) > 500) throw new LoiDuLieu("Ghi chú buổi tối đa 500 ký tự");
  const batDau = lucVN(v.ngay, gio);
  if (await db.bcaBuoiHoc.findUnique({ where: { mon_id_bat_dau_luc: { mon_id: mon.id, bat_dau_luc: batDau } } }))
    throw new LoiDuLieu("Đã có buổi môn này đúng giờ đó", 409);
  const b = await db.$transaction(async (tx) => {
    const b = await tx.bcaBuoiHoc.create({
      data: { mon_id: mon.id, ngay: s2d(v.ngay), bat_dau_luc: batDau, so_phut: soPhut, loai: "hoc_bu", bu_cho_buoi_id: v.buChoBuoiId ?? null, ghi_chu: v.ghiChu?.trim() || null },
    });
    await ghiNhatKy(u, "them_hoc_bu", "buoi_hoc", b.id, null, { mon: v.mon, ngay: v.ngay, gio, so_phut: soPhut, bu_cho_buoi_id: v.buChoBuoiId ?? null }, tx);
    return b;
  });
  // Cảnh báo chồng giờ (7.3)
  const ketThuc = batDau.getTime() + soPhut * 60_000;
  const cungNgay = await db.bcaBuoiHoc.findMany({ where: { ngay: s2d(v.ngay), trang_thai: "binh_thuong", id: { not: b.id } }, include: { mon: true } });
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

/** buoi-hoc.md Điều 8: nội dung ≤ 2000 ký tự, link record https, ghi chú nội bộ ≤ 500 (học sinh không thấy). Chủ + GV môn (kể cả sau buổi). */
export async function suaNoiDungBuoi(u: Nguoi, id: number, v: { noiDung?: string | null; linkRecord?: string | null; ghiChu?: string | null }) {
  canQuanLy(u);
  const b = await db.bcaBuoiHoc.findUnique({ where: { id } });
  if (!b) throw new LoiDuLieu("Không có buổi này", 404);
  canMon(u, b.mon_id);
  const data: { noi_dung?: string | null; link_record?: string | null; ghi_chu?: string | null } = {};
  if (v.ghiChu !== undefined) {
    const s = v.ghiChu?.trim() || null;
    if (s && s.length > 500) throw new LoiDuLieu("Ghi chú buổi tối đa 500 ký tự");
    data.ghi_chu = s;
  }
  if (v.noiDung !== undefined) {
    const s = v.noiDung?.trim() || null;
    if (s && s.length > 2000) throw new LoiDuLieu("Nội dung buổi tối đa 2.000 ký tự");
    data.noi_dung = s;
  }
  if (v.linkRecord !== undefined) {
    if (v.linkRecord && !v.linkRecord.trim()) data.link_record = null;
    else if (v.linkRecord) {
      const l = chuanHoaLink(v.linkRecord);
      if (!l) throw new LoiDuLieu("Link record không phải địa chỉ web — dán cả đường dẫn, bắt đầu bằng https://", 400, "link_sai");
      data.link_record = l;
    } else data.link_record = null;
  }
  if (!Object.keys(data).length) throw new LoiDuLieu("Không có trường nào để sửa (noiDung, linkRecord, ghiChu)"); // không ghi nhật ký rỗng
  return db.$transaction(async (tx) => {
    const r = await tx.bcaBuoiHoc.update({ where: { id }, data });
    await ghiNhatKy(u, "sua_noi_dung_buoi", "buoi_hoc", id, { noi_dung: b.noi_dung, link_record: b.link_record, ghi_chu: b.ghi_chu }, { noi_dung: r.noi_dung, link_record: r.link_record, ghi_chu: r.ghi_chu }, tx);
    return { id, noi_dung: r.noi_dung, link_record: r.link_record, ghi_chu: r.ghi_chu };
  });
}

// ── Buổi "có dữ liệu" (buoi-hoc.md 6.3): điểm danh, nội dung, record, ghi chú, đã huỷ (có lý do cho học sinh) hoặc có buổi bù trỏ tới ──
const DEM_DU_LIEU = { _count: { select: { diem_danh: true, buoi_bu: true } } } as const;
type BuoiDem = { trang_thai: string; noi_dung: string | null; link_record: string | null; ghi_chu: string | null; _count: { diem_danh: number; buoi_bu: number } };
const duLieuBuoi = (b: BuoiDem) =>
  [b._count.diem_danh > 0 && "diem_danh", !!b.noi_dung && "noi_dung", !!b.link_record && "link_record", !!b.ghi_chu && "ghi_chu", b.trang_thai === "huy" && "da_huy", b._count.buoi_bu > 0 && "co_buoi_bu"]
    .filter((x): x is string => !!x);

/**
 * buoi-hoc.md 6.3 + T42 — chủ xoá buổi TƯƠNG LAI chưa có dữ liệu (vd. sinh nhầm). Có dữ liệu hoặc đã bắt đầu thì chỉ huỷ được.
 * Nhật ký giữ bản chụp cả dòng để Hoàn tác (`hoanTacXoaBuoi`) trong HAN_HOAN_TAC_MS.
 */
export async function xoaBuoi(u: Nguoi, id: number, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaBuoi(tx, id); // không để một lượt điểm danh chen vào giữa lúc kiểm "chưa có dữ liệu" và lúc xoá
    const b = await tx.bcaBuoiHoc.findUnique({ where: { id }, include: DEM_DU_LIEU });
    if (!b) throw new LoiDuLieu("Không có buổi này", 404);
    const co = duLieuBuoi(b);
    if (co.length) throw new LoiDuLieu(`Buổi đã có dữ liệu (${co.join(", ")}) — chỉ huỷ được, không xoá`, 409, "co_du_lieu");
    if (b.bat_dau_luc <= luc) throw new LoiDuLieu("Buổi đã qua hoặc đang diễn ra — chỉ huỷ được (Huỷ buổi, kèm lý do), không xoá", 409, "da_qua");
    await tx.bcaBuoiHoc.delete({ where: { id } });
    // Bản chụp đủ để dựng lại (nội dung/record/ghi chú/lý do huỷ chắc chắn trống vì buổi chưa có dữ liệu).
    const chup = {
      mon_id: b.mon_id, ngay: d2s(b.ngay), bat_dau_luc: b.bat_dau_luc.toISOString(), so_phut: b.so_phut, loai: b.loai, trang_thai: b.trang_thai,
      bu_cho_buoi_id: b.bu_cho_buoi_id, da_diem_danh_luc: b.da_diem_danh_luc?.toISOString() ?? null, tao_luc: b.tao_luc.toISOString(),
    };
    const nk = await ghiNhatKy(u, "xoa_buoi", "buoi_hoc", id, chup, { luc: luc.toISOString() }, tx);
    return { id, da_xoa: true, nhatKyId: nk.id };
  });
}

/** T42 — Hoàn tác xoá buổi: dựng lại đúng dòng cũ (cùng id) từ bản chụp trong nhật ký; một lần, trong hạn. */
export async function hoanTacXoaBuoi(u: Nguoi, id: number, nhatKyId: number, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaNhatKy(tx, nhatKyId);
    const nk = await tx.bcaNhatKy.findUnique({ where: { id: nhatKyId } });
    if (!nk || nk.hanh_dong !== "xoa_buoi" || nk.doi_tuong_id !== String(id)) throw new LoiDuLieu("Không có lần xoá buổi này", 404);
    if (!conHanHoanTac((nk.sau as { luc?: string } | null)?.luc, luc)) throw new LoiDuLieu("Đã quá thời gian hoàn tác", 409, "het_gio");
    if (await tx.bcaBuoiHoc.findUnique({ where: { id } })) throw new LoiDuLieu("Buổi này đã được hoàn tác", 409, "da_hoan_tac");
    const c = nk.truoc as { mon_id: number; ngay: string; bat_dau_luc: string; so_phut: number; loai: "theo_lich" | "hoc_bu"; trang_thai: "binh_thuong" | "huy"; bu_cho_buoi_id: number | null; da_diem_danh_luc: string | null; tao_luc: string };
    if (await tx.bcaBuoiHoc.findUnique({ where: { mon_id_bat_dau_luc: { mon_id: c.mon_id, bat_dau_luc: new Date(c.bat_dau_luc) } } }))
      throw new LoiDuLieu("Đã có buổi khác cùng môn đúng giờ đó (vừa sinh lại?) — không hoàn tác được", 409, "trung");
    await tx.bcaBuoiHoc.create({
      data: {
        id, mon_id: c.mon_id, ngay: s2d(c.ngay), bat_dau_luc: new Date(c.bat_dau_luc), so_phut: c.so_phut, loai: c.loai, trang_thai: c.trang_thai,
        bu_cho_buoi_id: c.bu_cho_buoi_id, da_diem_danh_luc: c.da_diem_danh_luc ? new Date(c.da_diem_danh_luc) : null, tao_luc: new Date(c.tao_luc),
      },
    });
    await ghiNhatKy(u, "hoan_tac_xoa_buoi", "buoi_hoc", id, null, { nhat_ky_id: nhatKyId }, tx);
    return { id, khoi_phuc: true };
  });
}

/** T42 — buổi theo lịch còn thiếu của một tháng: ngày theo lịch mà môn chưa có buổi theo lịch nào (kể cả đã huỷ). Chỉ tạo buổi chưa bắt đầu. */
async function buoiConThieu(thang: string, luc: Date) {
  const ngays = ngayTrongThang(thang);
  const [mons, batDau] = await Promise.all([db.bcaMon.findMany({ orderBy: { thu_tu: "asc" } }), ngayBatDauLop()]);
  const co = await db.bcaBuoiHoc.findMany({ where: { loai: "theo_lich", ngay: { gte: s2d(ngays[0]), lte: s2d(ngays.at(-1)!) } }, select: { mon_id: true, ngay: true } });
  const daCo = new Set(co.map((b) => `${b.mon_id}|${d2s(b.ngay)}`));
  const thieu = buoiTheoLich(mons, thang, batDau).filter((b) => !daCo.has(`${b.mon_id}|${b.ngay}`));
  const ma = new Map(mons.map((m) => [m.id, m.ma]));
  return { thieu: thieu.filter((b) => b.bat_dau_luc > luc), da_qua: thieu.filter((b) => b.bat_dau_luc <= luc).length, ma };
}
const moTaBuoi = (ma: Map<number, string>) => (b: { mon_id: number; ngay: string; bat_dau_luc: Date }) => ({ mon: ma.get(b.mon_id), ngay: b.ngay, gio: gioVN(b.bat_dau_luc) });

/** Xem trước "Sinh buổi còn thiếu" (chỉ chủ, không ghi). `bo_qua_da_qua` = ngày thiếu đã qua, không sinh (buổi đã qua giữ nguyên, T8). */
export async function xemTruocBuoiConThieu(u: Nguoi, thang: string, luc = new Date()) {
  canChu(u);
  const { thieu, da_qua, ma } = await buoiConThieu(thang, luc);
  return { thang, se_tao: thieu.length, buoi: thieu.map(moTaBuoi(ma)), bo_qua_da_qua: da_qua };
}

/** T42 — "Sinh buổi còn thiếu": chỉ thêm buổi theo lịch còn thiếu, không đụng buổi có sẵn. */
export async function sinhBuoiConThieu(u: Nguoi, thang: string, luc = new Date()) {
  canChu(u);
  const { thieu, da_qua, ma } = await buoiConThieu(thang, luc);
  return db.$transaction(async (tx) => {
    const r = await tx.bcaBuoiHoc.createMany({ data: thieu.map((b) => ({ ...b, ngay: s2d(b.ngay) })), skipDuplicates: true });
    const buoi = thieu.map(moTaBuoi(ma));
    await ghiNhatKy(u, "sinh_buoi_con_thieu", "thang", thang, null, { tao_moi: r.count, buoi }, tx);
    return { thang, tao_moi: r.count, buoi, bo_qua_da_qua: da_qua };
  });
}
