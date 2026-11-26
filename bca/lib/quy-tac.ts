// Quy tắc nghiệp vụ thuần (không chạm CSDL). Nguồn: docs/bca/nghiep-vu/*.md.
import { congNgay, ddmm, lucVN, ngayTrongThang, ngayVN, phutVN, thuISO } from "./ngay";

export type Loai = "thu" | "chinh_thuc";
export type TrangThaiDD = "co" | "phep" | "vang";
/** Một ghi danh ở dạng ngày chuỗi. */
export type GD = { id?: number; ma_gd?: string; mon_id: number; loai: Loai; tu: string; den: string | null; huy: boolean; nghi?: boolean };
/** Ghi chú đánh dấu ghi danh bị chủ cắt bằng "Cho nghỉ" (để không hiện "Hết thử – hỏi em"). */
export const DAU_NGHI = "Cho nghỉ";

export const MAC_DINH = { SO_NGAY_HOC_THU: 14, NGAY_BAT_DAU_TINH_PHI: "2026-11-16", GIA_1_MON: 65_000, GIA_TU_2_MON: 55_000 };

// ── Ghi danh ──────────────────────────────────────────────────────────────
/** Điều 3.2: có hiệu lực vào ngày D. */
export const hieuLuc = (g: GD, d: string) => !g.huy && g.tu <= d && (g.den === null || d <= g.den);
/** Còn mở tính từ ngày D (đang hoặc sẽ hiệu lực). */
export const conMo = (g: GD, d: string) => !g.huy && (g.den === null || g.den >= d);
export const loaiVaoNgay = (gds: GD[], monId: number, d: string): Loai | null =>
  gds.find((g) => g.mon_id === monId && hieuLuc(g, d))?.loai ?? null;

/** Điều 5.1: 14 ngày tính từ ngày đăng ký (ngày giờ Việt Nam của thời điểm gửi đơn). */
export function khoangThu(lucDangKy: Date, soNgay = MAC_DINH.SO_NGAY_HOC_THU) {
  const tu = ngayVN(lucDangKy);
  return { tu, den: congNgay(tu, soNgay - 1) };
}

/** Điều 5.2: ngày hết của cửa sổ thử đang chạy (null nếu em không đang thử). */
export function hanThuChung(gds: GD[], h: string): string | null {
  const dens = gds.filter((g) => g.loai === "thu" && !g.huy && g.tu <= h && g.den! >= h).map((g) => g.den!);
  return dens.length ? dens.sort().at(-1)! : null;
}

/** Điều 4.1: ô môn xét theo hôm nay H. */
export function oMon(gds: GD[], monId: number, h: string): "hoc" | "thu" | "nghi" | null {
  const m = gds.filter((g) => g.mon_id === monId && !g.huy);
  if (!gds.some((g) => g.mon_id === monId)) return null;
  if (m.some((g) => g.loai === "chinh_thuc" && (g.den === null || g.den >= (h > g.tu ? h : g.tu)))) return "hoc";
  if (m.some((g) => g.loai === "thu" && g.den! >= h)) return "thu";
  return "nghi";
}

/** Điều 4.2: tình trạng một dòng. */
export function tinhTrang(gds: GD[], h: string): string {
  const s = gds.filter((g) => !g.huy);
  if (s.some((g) => g.loai === "chinh_thuc" && hieuLuc(g, h))) return "Đang học";
  const thu = s.filter((g) => g.loai === "thu" && hieuLuc(g, h));
  if (thu.length) {
    const den = thu.map((g) => g.den!).sort().at(-1)!;
    const ct = s.filter((g) => g.loai === "chinh_thuc" && g.tu > h).map((g) => g.tu).sort()[0];
    return ct ? `Thử → CT ${ddmm(ct)}` : `Thử đến ${ddmm(den)}`;
  }
  const sau = s.filter((g) => g.tu > h).map((g) => g.tu).sort()[0];
  if (sau) return `Bắt đầu ${ddmm(sau)}`;
  if (!gds.length) return "Chưa ghi danh";
  const het = hetThu(gds, h);
  return het ? `Hết thử ${ddmm(het)} – hỏi em` : "Đã nghỉ";
}

/** hom-nay.md mức 2: lần ghi danh gần nhất toàn là Thử, đã hết, không còn ghi danh mở. Trả ngày hết. */
export function hetThu(gds: GD[], h: string): string | null {
  const s = gds.filter((g) => !g.huy);
  if (!s.length || s.some((g) => conMo(g, h))) return null;
  const moiNhat = s.map((g) => g.den!).sort().at(-1)!;
  const lanCuoi = s.filter((g) => g.den === moiNhat);
  return lanCuoi.every((g) => g.loai === "thu" && !g.nghi) ? moiNhat : null;
}

/** hom-nay.md mức 3: ngày hết thử nếu nằm trong [H, H+3] và em chưa có Chính thức còn mở. */
export function thuSapHet(gds: GD[], h: string): string | null {
  if (gds.some((g) => g.loai === "chinh_thuc" && conMo(g, h))) return null;
  const den = hanThuChung(gds, h);
  return den && den <= congNgay(h, 3) ? den : null;
}

// ── Kế hoạch thay đổi ghi danh (trả danh sách việc; máy chủ ghi trong một transaction) ──
export type Viec =
  | { kieu: "tao"; mon_id: number; loai: Loai; tu: string; den: string | null; ghi_chu?: string }
  | { kieu: "sua_den"; id: number; den: string; ghi_chu?: string }
  | { kieu: "huy"; id: number; den: string };

export class LoiQuyTac extends Error {}

/** Điều 5.4: gia hạn thử (áp mọi môn đang thử — T4). */
export function keHoachGiaHan(gds: GD[], h: string, opt: { soNgay?: number; denNgay?: string }): { viec: Viec[]; denMoi: string; doanMoi: boolean } {
  const dangThu = gds.filter((g) => g.loai === "thu" && !g.huy && g.den! >= h);
  if (dangThu.length) {
    // Còn trong hạn (kể cả đoạn thử đã hẹn trước): dời ngày hết của cửa sổ chung.
    const denCu = dangThu.map((g) => g.den!).sort().at(-1)!;
    const denMoi = opt.denNgay ?? congNgay(denCu, soNgayHopLe(opt.soNgay));
    if (denMoi < h) throw new LoiQuyTac("Ngày hết mới phải từ hôm nay trở đi");
    const ctMo = (m: number) => gds.find((g) => g.mon_id === m && g.loai === "chinh_thuc" && conMo(g, h));
    const viec: Viec[] = [];
    for (const g of dangThu) {
      const ct = ctMo(g.mon_id);
      const den = ct && denMoi >= ct.tu ? congNgay(ct.tu, -1) : denMoi; // không chồng lên Chính thức đã hẹn
      if (den !== g.den && den >= g.tu) viec.push({ kieu: "sua_den", id: g.id!, den });
    }
    return { viec, denMoi, doanMoi: false };
  }
  const het = hetThu(gds, h);
  if (!het) throw new LoiQuyTac("Em không có môn học thử để gia hạn");
  // Đã hết hạn: đoạn thử mới từ hôm nay, không phủ ngược.
  const denMoi = opt.denNgay ?? congNgay(h, soNgayHopLe(opt.soNgay) - 1);
  if (denMoi < h) throw new LoiQuyTac("Ngày hết mới phải từ hôm nay trở đi");
  const mons = [...new Set(gds.filter((g) => !g.huy && g.loai === "thu" && g.den === het).map((g) => g.mon_id))];
  return { viec: mons.map((mon_id) => ({ kieu: "tao", mon_id, loai: "thu", tu: h, den: denMoi, ghi_chu: `Gia hạn sau khi hết thử ${ddmm(het)}` })), denMoi, doanMoi: true };
}
function soNgayHopLe(n?: number) {
  if (!Number.isInteger(n) || n! < 1 || n! > 60) throw new LoiQuyTac("Số ngày gia hạn phải là số nguyên 1–60");
  return n!;
}

/** Điều 7.2: ngày bắt đầu chính thức mặc định. */
export function ngayChinhThucMacDinh(gds: GD[], monId: number, h: string): string {
  const thu = gds.filter((g) => g.mon_id === monId && g.loai === "thu" && !g.huy && g.den! >= h).map((g) => g.den!).sort().at(-1);
  const chung = thu ?? hanThuChung(gds, h);
  return chung ? congNgay(chung, 1) : h;
}

/** Điều 7.1: chuyển chính thức một môn từ ngày tu. */
export function keHoachChinhThuc(gds: GD[], monId: number, tu: string): Viec[] {
  const m = gds.filter((g) => g.mon_id === monId && !g.huy);
  if (m.some((g) => g.loai === "chinh_thuc" && (g.den === null || g.den >= tu)))
    throw new LoiQuyTac("Em đã có ghi danh chính thức môn này");
  const viec: Viec[] = [];
  let som = false;
  for (const g of m.filter((g) => g.den === null || g.den >= tu)) {
    if (g.tu >= tu) viec.push({ kieu: "huy", id: g.id!, den: congNgay(g.tu, -1) });
    else viec.push({ kieu: "sua_den", id: g.id!, den: congNgay(tu, -1) });
    som = true;
  }
  viec.push({ kieu: "tao", mon_id: monId, loai: "chinh_thuc", tu, den: null, ghi_chu: som ? `Lên chính thức sớm từ ${ddmm(tu)}` : undefined });
  return viec;
}

/** Điều 6.1: thêm môn Thử. */
export function keHoachThemThu(gds: GD[], monId: number, h: string, soNgay = MAC_DINH.SO_NGAY_HOC_THU): Viec[] {
  const m = gds.filter((g) => g.mon_id === monId && conMo(g, h));
  const ct = m.find((g) => g.loai === "chinh_thuc");
  if (ct) throw new LoiQuyTac(`Em đang học chính thức môn này (${ct.ma_gd ?? ""})`.replace(" ()", ""));
  const trung = m.find((g) => g.loai === "thu");
  if (trung) throw new LoiQuyTac(`Đã có ${trung.ma_gd ?? "ghi danh thử môn này"}`);
  const den = hanThuChung(gds, h) ?? congNgay(h, soNgay - 1);
  return [{ kieu: "tao", mon_id: monId, loai: "thu", tu: h, den }];
}

/** Điều 8.1: ngày "học đến hết" mặc định khi cho nghỉ (luật 22:00). */
export const ngayNghiMacDinh = (luc: Date) => (phutVN(luc) < 22 * 60 ? congNgay(ngayVN(luc), -1) : ngayVN(luc));

/** Điều 8.1: cho nghỉ môn đến hết ngày cat. */
export function keHoachNghi(gds: GD[], monId: number, cat: string): Viec[] {
  const viec: Viec[] = [];
  for (const g of gds.filter((g) => g.mon_id === monId && conMo(g, cat))) {
    if (g.tu > cat) viec.push({ kieu: "huy", id: g.id!, den: congNgay(g.tu, -1) });
    else if (g.den === null || g.den > cat) viec.push({ kieu: "sua_den", id: g.id!, den: cat, ghi_chu: `${DAU_NGHI} đến hết ${ddmm(cat)}` });
  }
  if (!viec.length) throw new LoiQuyTac("Em không còn ghi danh mở ở môn này");
  return viec;
}

// ── Buổi học ──────────────────────────────────────────────────────────────
export type MonLich = { id: number; thu: number[]; gio_bat_dau: string; so_phut: number };
/** buoi-hoc.md Điều 3.1: buổi theo lịch của một tháng, bỏ buổi trước ngày bắt đầu. */
export function buoiTheoLich(mons: MonLich[], thang: string, ngayBatDau: string) {
  const ra: { mon_id: number; ngay: string; bat_dau_luc: Date; so_phut: number }[] = [];
  for (const ngay of ngayTrongThang(thang)) {
    if (ngay < ngayBatDau) continue;
    for (const m of mons) if (m.thu.includes(thuISO(ngay))) ra.push({ mon_id: m.id, ngay, bat_dau_luc: lucVN(ngay, m.gio_bat_dau), so_phut: m.so_phut });
  }
  return ra;
}

/** buoi-hoc.md 8.2: thêm https:// nếu thiếu; chuỗi không phải URL thì null. */
export function chuanHoaLink(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s.replace(/^http:/i, "https:") : `https://${s}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

// ── Điểm danh ─────────────────────────────────────────────────────────────
const PHUT = 60_000;
/** diem-danh.md 3.4: mở từ 30 phút trước giờ bắt đầu (22:15 → 21:45). */
export const moDiemDanh = (batDau: Date, luc: Date) => luc.getTime() >= batDau.getTime() - 30 * PHUT;
/** diem-danh.md 3.5 / T11: quá 48 giờ từ giờ bắt đầu thì phải xác nhận. */
export const qua48Gio = (batDau: Date, luc: Date) => luc.getTime() - batDau.getTime() > 48 * 60 * PHUT;

/** diem-danh.md 6.3: Có +1, Phép giữ, Vắng về 0; null (chưa điểm/huỷ) bỏ qua. Theo thứ tự thời gian. */
export function chuoi(ds: (TrangThaiDD | null)[]) {
  let n = 0;
  for (const t of ds) if (t === "co") n++; else if (t === "vang") n = 0;
  return n;
}
export function demDD(ds: (TrangThaiDD | null | undefined)[]) {
  const c = { co: 0, phep: 0, vang: 0 };
  for (const t of ds) if (t) c[t]++;
  return c;
}

/** hom-nay.md 2.2 / T12: từ 00:00 đến 05:59 vẫn hiện buổi tối qua. */
export const conGioBuoiToiQua = (luc: Date) => phutVN(luc) < 6 * 60;

// ── Tiền (đồng, số nguyên) — QUYET-DINH 13, T5 ──────────────────────────────
/** Đơn giá theo số môn có buổi > 0 trong kỳ. */
export const donGiaKy = (soMon: number, gia = MAC_DINH) => (soMon >= 2 ? gia.GIA_TU_2_MON : gia.GIA_1_MON);
/** Tiền một kỳ từ số buổi tính phí theo từng môn. */
export function tienKy(soBuoiTheoMon: number[], gia = MAC_DINH) {
  const coBuoi = soBuoiTheoMon.filter((n) => n > 0);
  return coBuoi.reduce((t, n) => t + n, 0) * donGiaKy(coBuoi.length, gia);
}
