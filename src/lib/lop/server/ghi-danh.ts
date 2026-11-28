// Thao tác ghi danh — CHỈ CHỦ LỚP (QUYET-DINH 16, phan-quyen.md Điều 3). Chép từ bca/server/ghi-danh.ts; bỏ đơn giá dự kiến (học phí chờ chủ, README mục 6.4).
import { congNgay, ngayVN, s2d, d2sOrNull } from "../ngay";
import { canChu, LoiDuLieu, type Nguoi } from "../quyen";
import {
  conHanHoanTac, conMo, keHoachChinhThuc, keHoachGiaHan, keHoachNghi, keHoachThemThu, ngayChinhThucMacDinh, ngayNghiMacDinh, LoiQuyTac, type Viec,
} from "../quy-tac";
import { prisma as db } from "@/lib/prisma";
import type { Tx } from "./du-lieu";
import { capMa, napGD, soNgayHocThu } from "./du-lieu";
import { ghiNhatKy, khoaNhatKy } from "./nhat-ky";

async function timHs(tx: Tx, maHs: string) {
  const hs = await tx.bcaHocSinh.findUnique({ where: { ma_hs: maHs }, select: { id: true, ma_hs: true, an_luc: true } });
  if (!hs) throw new LoiDuLieu(`Không có học sinh ${maHs}`, 404);
  return hs;
}
async function monTheoMa(tx: Tx, ma: string) {
  const m = await tx.bcaMon.findUnique({ where: { ma } });
  if (!m) throw new LoiDuLieu(`Không có môn ${ma}`, 404);
  return m;
}

export type ThayDoi = { id: number; ma_gd: string; kieu: Viec["kieu"]; den_cu: string | null; den_moi: string | null; nghi?: boolean };
/** Ghi kế hoạch vào CSDL, mỗi dòng một nhật ký (ghi-danh.md 3.5). */
export async function apDung(tx: Tx, u: Nguoi, hsId: number, viec: Viec[], hanh_dong: string, ly_do: string | null, luc: Date) {
  const ra: ThayDoi[] = [];
  for (const v of viec) {
    if (v.kieu === "tao") {
      const g = await tx.bcaGhiDanh.create({
        data: { ma_gd: await capMa(tx, "gd"), hoc_sinh_id: hsId, mon_id: v.mon_id, loai: v.loai, tu_ngay: s2d(v.tu), den_ngay: v.den ? s2d(v.den) : null, ghi_chu: v.ghi_chu, tao_boi: u.vai === "hoc_sinh" ? null : u.id },
      });
      ra.push({ id: g.id, ma_gd: g.ma_gd, kieu: "tao", den_cu: null, den_moi: v.den });
      await ghiNhatKy(u, hanh_dong, "ghi_danh", g.id, null, { ma_gd: g.ma_gd, hoc_sinh_id: hsId, mon_id: v.mon_id, loai: v.loai, tu_ngay: v.tu, den_ngay: v.den, ly_do }, tx);
    } else {
      const cu = await tx.bcaGhiDanh.findUniqueOrThrow({ where: { id: v.id } });
      const g = await tx.bcaGhiDanh.update({
        where: { id: v.id },
        data: {
          den_ngay: s2d(v.den), ...(v.kieu === "huy" ? { huy_luc: luc } : {}),
          ...(v.kieu === "sua_den" && v.ghi_chu ? { ghi_chu: v.ghi_chu } : {}),
          ...(v.kieu === "sua_den" && v.nghi ? { nghi_luc: luc, nghi_boi: u.vai === "hoc_sinh" ? null : u.id } : {}),
        },
      });
      const nghi = v.kieu === "sua_den" && !!v.nghi;
      ra.push({ id: g.id, ma_gd: g.ma_gd, kieu: v.kieu, den_cu: d2sOrNull(cu.den_ngay), den_moi: v.den, ...(nghi ? { nghi } : {}) });
      await ghiNhatKy(u, hanh_dong, "ghi_danh", g.id, { den_ngay: d2sOrNull(cu.den_ngay), huy_luc: cu.huy_luc, ghi_chu: cu.ghi_chu, nghi_luc: cu.nghi_luc }, { den_ngay: v.den, huy: v.kieu === "huy", ghi_chu: g.ghi_chu, nghi, ly_do }, tx);
    }
  }
  return ra;
}

/** ghi-danh.md 5.4 — một hoặc nhiều em (T29), lý do bắt buộc. Trả nhatKyId để Hoàn tác. */
export async function giaHanThu(u: Nguoi, maHsList: string[], opt: { soNgay?: number; denNgay?: string }, lyDo: string, luc = new Date()) {
  canChu(u);
  if (!lyDo?.trim()) throw new LoiDuLieu("Cần ghi lý do gia hạn");
  if (!maHsList.length) throw new LoiDuLieu("Chưa chọn học sinh");
  if (maHsList.length > 200 || lyDo.length > 300) throw new LoiDuLieu("Tối đa 200 em mỗi lần, lý do tối đa 300 ký tự");
  const n = opt.soNgay;
  if ((n !== undefined || opt.denNgay === undefined) && !(Number.isInteger(n) && n! >= 1 && n! <= 60)) throw new LoiDuLieu("Số ngày gia hạn phải là số nguyên 1–60"); // 400, không 409
  const h = ngayVN(luc);
  return db.$transaction(async (tx) => {
    const ketQua: { ma_hs: string; den_moi: string; doan_moi: boolean }[] = [];
    const tatCa: (ThayDoi & { hoc_sinh_id: number })[] = [];
    for (const ma of [...new Set(maHsList)]) {
      const hs = await timHs(tx, ma);
      const gds = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
      let kh;
      try {
        kh = keHoachGiaHan(gds, h, opt);
      } catch (e) {
        throw e instanceof LoiQuyTac ? new LoiQuyTac(`${ma}: ${e.message}`) : e;
      }
      const td = await apDung(tx, u, hs.id, kh.viec, "gia_han_thu", lyDo.trim(), luc);
      tatCa.push(...td.map((t) => ({ ...t, hoc_sinh_id: hs.id })));
      ketQua.push({ ma_hs: ma, den_moi: kh.denMoi, doan_moi: kh.doanMoi });
    }
    const nk = await ghiNhatKy(u, "gia_han_thu", "nhom_gia_han", null, null, { luc: luc.toISOString(), ly_do: lyDo.trim(), opt, thay_doi: tatCa }, tx);
    return { nhatKyId: nk.id, ketQua };
  });
}

/**
 * Hoàn tác một lần gia hạn (T29): chỉ chủ, một lần, trong HAN_HOAN_TAC_MS tính từ lúc gia hạn; chỉ trả lại các dòng chưa bị sửa sau đó.
 * Đoạn thử sắp bị xoá/cắt đã có điểm danh ⇒ 409, không đổi gì (không để điểm danh mồ côi).
 */
export async function hoanTacGiaHan(u: Nguoi, nhatKyId: number, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaNhatKy(tx, nhatKyId);
    const nk = await tx.bcaNhatKy.findUnique({ where: { id: nhatKyId } });
    if (!nk || nk.hanh_dong !== "gia_han_thu" || nk.doi_tuong !== "nhom_gia_han") throw new LoiDuLieu("Không có lần gia hạn này", 404);
    const sau = nk.sau as { luc?: string; thay_doi: (ThayDoi & { hoc_sinh_id: number })[] };
    if (!conHanHoanTac(sau.luc, luc)) throw new LoiDuLieu("Đã quá thời gian hoàn tác", 409, "het_gio");
    if (await tx.bcaNhatKy.findFirst({ where: { hanh_dong: "hoan_tac_gia_han", doi_tuong: "nhom_gia_han", doi_tuong_id: String(nhatKyId) } }))
      throw new LoiDuLieu("Lần gia hạn này đã được hoàn tác", 409, "da_hoan_tac");
    let traLai = 0, boQua = 0;
    for (const t of sau.thay_doi) {
      const g = await tx.bcaGhiDanh.findUnique({ where: { id: t.id } });
      if (!g || d2sOrNull(g.den_ngay) !== t.den_moi || g.huy_luc) { boQua++; continue; }
      // Ngày em sẽ mất tên: cả đoạn mới (tao) hoặc phần đã dời thêm (sua_den).
      const tu = t.kieu === "tao" ? g.tu_ngay : s2d(congNgay(t.den_cu!, 1));
      const coDD = await tx.bcaDiemDanh.count({ where: { hoc_sinh_id: g.hoc_sinh_id, buoi: { mon_id: g.mon_id, ngay: { gte: tu, lte: g.den_ngay! } } } });
      if (coDD) throw new LoiDuLieu(`Đoạn thử gia hạn của ${g.ma_gd} đã có ${coDD} điểm danh — không hoàn tác được`, 409, "co_diem_danh");
      if (t.kieu === "tao") {
        await tx.bcaGhiDanh.delete({ where: { id: t.id } }); // đoạn thử mới chưa gắn dữ liệu nào (điểm danh gắn theo buổi + em)
      } else {
        await tx.bcaGhiDanh.update({ where: { id: t.id }, data: { den_ngay: t.den_cu ? s2d(t.den_cu) : null } });
      }
      await ghiNhatKy(u, "hoan_tac_gia_han", "ghi_danh", t.id, { den_ngay: t.den_moi }, t.kieu === "tao" ? { xoa: true } : { den_ngay: t.den_cu }, tx);
      traLai++;
    }
    await ghiNhatKy(u, "hoan_tac_gia_han", "nhom_gia_han", nhatKyId, null, { tra_lai: traLai, bo_qua: boQua }, tx);
    return { traLai, boQua };
  });
}

/** ghi-danh.md Điều 7 — chuyển chính thức các môn từ một ngày (mặc định 7.2). */
export async function chuyenChinhThuc(u: Nguoi, maHs: string, monMas: string[], opt: { tuNgay?: string; nghiMonThuConLai?: boolean } = {}, luc = new Date()) {
  canChu(u);
  if (!monMas.length) throw new LoiDuLieu("Chưa chọn môn");
  const h = ngayVN(luc);
  return db.$transaction(async (tx) => {
    const hs = await timHs(tx, maHs);
    const gds = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
    const thayDoi: ThayDoi[] = [];
    const monIds: number[] = [];
    for (const ma of monMas) {
      const m = await monTheoMa(tx, ma);
      monIds.push(m.id);
      const tu = opt.tuNgay ?? ngayChinhThucMacDinh(gds, m.id, h);
      thayDoi.push(...(await apDung(tx, u, hs.id, keHoachChinhThuc(gds, m.id, tu), "chuyen_chinh_thuc", null, luc)));
    }
    if (opt.nghiMonThuConLai) {
      const cat = ngayNghiMacDinh(luc);
      const con = [...new Set(gds.filter((g) => g.loai === "thu" && conMo(g, cat) && !monIds.includes(g.mon_id)).map((g) => g.mon_id))];
      for (const m of con) thayDoi.push(...(await apDung(tx, u, hs.id, keHoachNghi(gds, m, cat), "nghi_mon", "Cho nghỉ các môn thử còn lại khi lên chính thức", luc)));
    }
    const sau = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
    const soMonCT = new Set(sau.filter((g) => g.loai === "chinh_thuc" && conMo(g, h)).map((g) => g.mon_id)).size;
    const nk = await ghiNhatKy(u, "chuyen_chinh_thuc", "nhom_chuyen_chinh_thuc", hs.ma_hs, null, { luc: luc.toISOString(), mon: monMas, thay_doi: thayDoi }, tx);
    return { nhatKyId: nk.id, thayDoi, soMonChinhThuc: soMonCT };
  });
}

/** Trả các dòng về trước một thao tác — tất cả hoặc không: dòng nào đã bị sửa sau đó thì không làm gì, trả false. */
export async function traLai(tx: Tx, u: Nguoi, thayDoi: ThayDoi[], hanh_dong: string) {
  const rows = await tx.bcaGhiDanh.findMany({ where: { id: { in: thayDoi.map((t) => t.id) } } });
  const conNguyen = (t: ThayDoi) => {
    const g = rows.find((r) => r.id === t.id);
    return !!g && d2sOrNull(g.den_ngay) === t.den_moi && (t.kieu === "huy") === !!g.huy_luc && (!t.nghi || !!g.nghi_luc);
  };
  if (!thayDoi.every(conNguyen)) return false;
  // Xoá dòng mới tạo trước, rồi mới trả ngày cũ (tránh chồng ngày).
  for (const t of [...thayDoi].sort((a, b) => Number(b.kieu === "tao") - Number(a.kieu === "tao"))) {
    if (t.kieu === "tao") await tx.bcaGhiDanh.delete({ where: { id: t.id } });
    else await tx.bcaGhiDanh.update({ where: { id: t.id }, data: { den_ngay: t.den_cu ? s2d(t.den_cu) : null, huy_luc: null, ...(t.nghi ? { nghi_luc: null, nghi_boi: null } : {}) } });
    await ghiNhatKy(u, hanh_dong, "ghi_danh", t.id, { den_ngay: t.den_moi }, t.kieu === "tao" ? { xoa: true } : { den_ngay: t.den_cu }, tx);
  }
  return true;
}

/** Hoàn tác một lần chuyển chính thức: chỉ chủ, một lần, trong hạn, và chỉ khi chưa ai sửa các dòng đó (tất cả hoặc không). */
export async function hoanTacChuyenChinhThuc(u: Nguoi, maHs: string, nhatKyId: number, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaNhatKy(tx, nhatKyId);
    const nk = await tx.bcaNhatKy.findUnique({ where: { id: nhatKyId } });
    if (!nk || nk.doi_tuong !== "nhom_chuyen_chinh_thuc" || nk.doi_tuong_id !== maHs) throw new LoiDuLieu("Không có lần chuyển chính thức này", 404);
    const sau = nk.sau as { luc: string; thay_doi: ThayDoi[] };
    if (!conHanHoanTac(sau.luc, luc)) throw new LoiDuLieu("Đã quá thời gian hoàn tác", 409, "het_gio");
    if (await tx.bcaNhatKy.findFirst({ where: { hanh_dong: "hoan_tac_chuyen_chinh_thuc", doi_tuong: "nhom_chuyen_chinh_thuc", doi_tuong_id: String(nhatKyId) } }))
      throw new LoiDuLieu("Lần chuyển này đã được hoàn tác", 409, "da_hoan_tac");
    if (!(await traLai(tx, u, sau.thay_doi, "hoan_tac_chuyen_chinh_thuc")))
      throw new LoiDuLieu("Ghi danh đã bị sửa sau lần chuyển này — không hoàn tác được", 409, "da_sua");
    await ghiNhatKy(u, "hoan_tac_chuyen_chinh_thuc", "nhom_chuyen_chinh_thuc", nhatKyId, null, { ma_hs: maHs, so_dong: sau.thay_doi.length }, tx);
    return { traLai: sau.thay_doi.length };
  });
}

/** ghi-danh.md Điều 6 — ghi danh thêm môn (Thử theo cửa sổ chung; Chính thức = chuyển chính thức). */
export async function themMon(u: Nguoi, maHs: string, monMa: string, loai: "thu" | "chinh_thuc", tuNgay?: string, luc = new Date()) {
  canChu(u);
  if (loai === "chinh_thuc") return chuyenChinhThuc(u, maHs, [monMa], { tuNgay }, luc);
  const h = ngayVN(luc);
  return db.$transaction(async (tx) => {
    const hs = await timHs(tx, maHs);
    const m = await monTheoMa(tx, monMa);
    const gds = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
    const SO_NGAY_HOC_THU = await soNgayHocThu(tx);
    return { thayDoi: await apDung(tx, u, hs.id, keHoachThemThu(gds, m.id, h, SO_NGAY_HOC_THU), "them_mon", null, luc) };
  });
}

/** ghi-danh.md Điều 8 — cho nghỉ một hoặc nhiều môn, mặc định theo luật 22:00; ghi nghi_luc (T34). */
export async function nghiMon(u: Nguoi, maHs: string, monMa: string | string[], denNgay?: string, luc = new Date()) {
  canChu(u);
  const mas = [monMa].flat();
  if (!mas.length) throw new LoiDuLieu("Chưa chọn môn");
  return db.$transaction(async (tx) => {
    const hs = await timHs(tx, maHs);
    const gds = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
    const cat = denNgay ?? ngayNghiMacDinh(luc);
    const thayDoi: ThayDoi[] = [];
    for (const ma of mas) thayDoi.push(...(await apDung(tx, u, hs.id, keHoachNghi(gds, (await monTheoMa(tx, ma)).id, cat), "nghi_mon", null, luc)));
    return { denNgay: cat, thayDoi };
  });
}

/** ghi-danh.md Điều 10 / T7 — ẩn hồ sơ (không xoá cứng): dừng mọi ghi danh còn mở theo luật 22:00, ghi nghi_luc. */
export async function anHocSinh(u: Nguoi, maHs: string, denNgay?: string, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const hs = await timHs(tx, maHs);
    if (hs.an_luc) throw new LoiDuLieu("Hồ sơ đã ẩn", 409);
    const gds = (await napGD({ hoc_sinh_id: hs.id }, tx)).get(hs.id) ?? [];
    const cat = denNgay ?? ngayNghiMacDinh(luc);
    const thayDoi: ThayDoi[] = [];
    for (const m of new Set(gds.filter((g) => conMo(g, cat)).map((g) => g.mon_id)))
      thayDoi.push(...(await apDung(tx, u, hs.id, keHoachNghi(gds, m, cat), "an_hoc_sinh", null, luc)));
    await tx.bcaHocSinh.update({ where: { id: hs.id }, data: { an_luc: luc } });
    const gdIdToiDa = (await tx.bcaGhiDanh.aggregate({ _max: { id: true } }))._max.id ?? 0; // ghi danh id lớn hơn = ghi danh lại sau khi ẩn
    await ghiNhatKy(u, "an_hoc_sinh", "hoc_sinh", maHs, { an_luc: null }, { an_luc: luc.toISOString(), den_ngay: cat, thay_doi: thayDoi, gd_id_toi_da: gdIdToiDa }, tx);
    return { ma_hs: maHs, an_luc: luc, denNgay: cat, thayDoi };
  });
}

/** ghi-danh.md 10.2 — bỏ ẩn. Khôi phục ngày cũ chỉ khi bỏ ẩn ngay trong ngày (tick nhầm), chưa ghi danh lại và các dòng chưa bị sửa. */
export async function boAnHocSinh(u: Nguoi, maHs: string, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const hs = await timHs(tx, maHs);
    if (!hs.an_luc) throw new LoiDuLieu("Hồ sơ không bị ẩn", 409);
    const nk = await tx.bcaNhatKy.findFirst({ where: { hanh_dong: "an_hoc_sinh", doi_tuong: "hoc_sinh", doi_tuong_id: maHs }, orderBy: { id: "desc" } });
    const sauAn = nk?.sau as { thay_doi?: ThayDoi[]; gd_id_toi_da?: number } | null;
    const thayDoi = sauAn?.thay_doi ?? [];
    // So theo id (không theo đồng hồ CSDL): ghi danh tạo sau lúc ẩn có id lớn hơn mốc ghi lúc ẩn.
    const coGdMoi = await tx.bcaGhiDanh.count({ where: { hoc_sinh_id: hs.id, ...(sauAn?.gd_id_toi_da !== undefined ? { id: { gt: sauAn.gd_id_toi_da } } : { tao_luc: { gt: hs.an_luc } }) } });
    const khoiPhuc = ngayVN(hs.an_luc) === ngayVN(luc) && !coGdMoi && thayDoi.length > 0 && (await traLai(tx, u, thayDoi, "bo_an_hoc_sinh"));
    await tx.bcaHocSinh.update({ where: { id: hs.id }, data: { an_luc: null } });
    await ghiNhatKy(u, "bo_an_hoc_sinh", "hoc_sinh", maHs, { an_luc: hs.an_luc.toISOString() }, { an_luc: null, khoi_phuc_ghi_danh: khoiPhuc }, tx);
    return { ma_hs: maHs, khoi_phuc_ghi_danh: khoiPhuc };
  });
}
