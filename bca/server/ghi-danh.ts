// Thao tác ghi danh — CHỈ CHỦ LỚP (QUYET-DINH 16, phan-quyen.md Điều 3).
import { ngayVN, s2d, d2sOrNull } from "@/lib/ngay";
import { canChu, LoiDuLieu, type Nguoi } from "@/lib/quyen";
import {
  donGiaKy, conMo, keHoachChinhThuc, keHoachGiaHan, keHoachNghi, keHoachThemThu, ngayChinhThucMacDinh, ngayNghiMacDinh, LoiQuyTac, type Viec,
} from "@/lib/quy-tac";
import { db, type Tx } from "./db";
import { caiDat, capMa, napGD } from "./du-lieu";
import { ghiNhatKy } from "./nhat-ky";

async function timHs(tx: Tx, maHs: string) {
  const hs = await tx.hoc_sinh.findUnique({ where: { ma_hs: maHs }, select: { id: true, ma_hs: true, an_luc: true } });
  if (!hs) throw new LoiDuLieu(`Không có học sinh ${maHs}`, 404);
  return hs;
}
async function monTheoMa(tx: Tx, ma: string) {
  const m = await tx.mon.findUnique({ where: { ma } });
  if (!m) throw new LoiDuLieu(`Không có môn ${ma}`, 404);
  return m;
}

type ThayDoi = { id: number; ma_gd: string; kieu: Viec["kieu"]; den_cu: string | null; den_moi: string | null; nghi?: boolean };
/** Ghi kế hoạch vào CSDL, mỗi dòng một nhật ký (ghi-danh.md 3.5). */
async function apDung(tx: Tx, u: Nguoi, hsId: number, viec: Viec[], hanh_dong: string, ly_do: string | null, luc: Date) {
  const ra: ThayDoi[] = [];
  for (const v of viec) {
    if (v.kieu === "tao") {
      const g = await tx.ghi_danh.create({
        data: { ma_gd: await capMa(tx, "gd"), hoc_sinh_id: hsId, mon_id: v.mon_id, loai: v.loai, tu_ngay: s2d(v.tu), den_ngay: v.den ? s2d(v.den) : null, ghi_chu: v.ghi_chu, tao_boi: u.vai === "hoc_sinh" ? null : u.id },
      });
      ra.push({ id: g.id, ma_gd: g.ma_gd, kieu: "tao", den_cu: null, den_moi: v.den });
      await ghiNhatKy(u, hanh_dong, "ghi_danh", g.id, null, { ma_gd: g.ma_gd, hoc_sinh_id: hsId, mon_id: v.mon_id, loai: v.loai, tu_ngay: v.tu, den_ngay: v.den, ly_do }, tx);
    } else {
      const cu = await tx.ghi_danh.findUniqueOrThrow({ where: { id: v.id } });
      const g = await tx.ghi_danh.update({
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
    const nk = await ghiNhatKy(u, "gia_han_thu", "nhom_gia_han", null, null, { ly_do: lyDo.trim(), opt, thay_doi: tatCa }, tx);
    return { nhatKyId: nk.id, ketQua };
  });
}

/** Hoàn tác một lần gia hạn (T29): chỉ trả lại các dòng chưa bị sửa sau đó. */
export async function hoanTacGiaHan(u: Nguoi, nhatKyId: number) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const nk = await tx.nhat_ky.findUnique({ where: { id: nhatKyId } });
    if (!nk || nk.hanh_dong !== "gia_han_thu" || nk.doi_tuong !== "nhom_gia_han") throw new LoiDuLieu("Không có lần gia hạn này", 404);
    if (await tx.nhat_ky.findFirst({ where: { hanh_dong: "hoan_tac_gia_han", doi_tuong_id: String(nhatKyId) } })) throw new LoiDuLieu("Lần gia hạn này đã được hoàn tác", 409);
    const thayDoi = (nk.sau as { thay_doi: (ThayDoi & { hoc_sinh_id: number })[] }).thay_doi;
    let traLai = 0, boQua = 0;
    for (const t of thayDoi) {
      const g = await tx.ghi_danh.findUnique({ where: { id: t.id } });
      if (!g || d2sOrNull(g.den_ngay) !== t.den_moi || g.huy_luc) { boQua++; continue; }
      if (t.kieu === "tao") {
        await tx.ghi_danh.delete({ where: { id: t.id } }); // đoạn thử mới chưa gắn dữ liệu nào (điểm danh gắn theo buổi + em)
      } else {
        await tx.ghi_danh.update({ where: { id: t.id }, data: { den_ngay: t.den_cu ? s2d(t.den_cu) : null } });
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
    const gia = await caiDat(tx);
    return { thayDoi, donGiaDuKien: donGiaKy(soMonCT, gia), soMonChinhThuc: soMonCT };
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
    const { SO_NGAY_HOC_THU } = await caiDat(tx);
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
