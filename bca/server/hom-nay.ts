// Màn Hôm nay (hom-nay.md), lọc theo vai ở máy chủ (Điều 6).
import { congNgay, d2s, gioVN, ngayTrongThang, ngayVN, s2d, soNgayGiua, thangCua } from "@/lib/ngay";
import { canChu, canQuanLy, laChu, LoiDuLieu, monXemDuoc, type Nguoi, type NguoiQuanLy } from "@/lib/quyen";
import { conGioBuoiToiQua, hetThu, hieuLuc, moDiemDanh, thuSapHet, type GD } from "@/lib/quy-tac";
import { chuanHoaGmail, gmailHopLe, sdtHopLe } from "@/lib/chuan-hoa";
import { db } from "./db";
import { giaoVienTheoMon, napGD, napMon } from "./du-lieu";
import { tienDo } from "./diem-danh";
import { ghiNhatKy } from "./nhat-ky";

/** Loại việc → số ngày ẩn khi đánh dấu xong (hom-nay.md 3.3: học thử 3 ngày, việc khác hết hôm nay). */
export const NGAY_AN_VIEC: Record<string, number> = {
  don_cho_duyet: 1, het_thu: 3, thu_sap_het: 3, buoi_chua_diem_danh: 1, em_vang_nhieu: 1, buoi_thieu_record: 1, sua_du_lieu: 1,
};
/** Còn ẩn vào ngày h không (đánh dấu lúc `luc`, tính theo ngày giờ Việt Nam). */
export const conAn = (loai: string, luc: Date, h: string) => h <= congNgay(ngayVN(luc), (NGAY_AN_VIEC[loai] ?? 1) - 1);

type B = Awaited<ReturnType<typeof db.buoi_hoc.findMany>>[number];

/** Phần chung của 4 khối: môn xem được theo vai, buổi trong [tu, den] và tiến độ điểm danh, cách dựng thẻ buổi. */
async function napBuoi(u: NguoiQuanLy, luc: Date, tu: string, den: string) {
  const monIds = monXemDuoc(u);
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const idsMon = mons.map((m) => m.id);
  const [gvMon, buois] = await Promise.all([
    giaoVienTheoMon(idsMon),
    db.buoi_hoc.findMany({ where: { mon_id: { in: idsMon }, ngay: { gte: s2d(tu), lte: s2d(den) } }, orderBy: { bat_dau_luc: "asc" } }),
  ]);
  const tenMon = new Map(mons.map((m) => [m.id, { ma: m.ma, ten: m.ten_ngan, ten_day_du: m.ten_day_du, link_meet: m.link_meet, giao_vien: gvMon.get(m.id) ?? [] }]));
  const td = await tienDo(buois);
  const the = (b: B) => {
    const t = td.get(b.id)!;
    return {
      id: b.id, mon: tenMon.get(b.mon_id), ngay: d2s(b.ngay), gio: `${gioVN(b.bat_dau_luc)}–${gioVN(new Date(b.bat_dau_luc.getTime() + b.so_phut * 60_000))}`,
      loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy, chinh_thuc: t.chinh_thuc, thu: t.thu, si_so: t.si_so, da_diem: t.da_diem,
      mo_diem_danh: b.trang_thai !== "huy" && moDiemDanh(b.bat_dau_luc, luc), co_record: !!b.link_record,
    };
  };
  const chuaDu = (b: B) => b.trang_thai !== "huy" && td.get(b.id)!.da_diem < td.get(b.id)!.si_so;
  /** T12: 00:00–05:59 vẫn hiện buổi tối qua chưa điểm đủ. */
  const toiQua = (h: string) => (conGioBuoiToiQua(luc) ? buois.filter((b) => d2s(b.ngay) === congNgay(h, -1) && chuaDu(b)) : []);
  return { mons, tenMon, buois, td, the, chuaDu, toiQua };
}

/** Học sinh chưa ẩn + ghi danh các môn xem được (cột theo vai). */
async function napHs(u: NguoiQuanLy, idsMon: number[]) {
  const chu = laChu(u);
  const [hs, gdMap] = await Promise.all([
    db.hoc_sinh.findMany({
      where: { an_luc: null },
      select: { id: true, ma_hs: true, ho_ten: true, ...(chu ? { gmail: true, sdt_hs: true, sdt_ph: true, lua_id: true, lua: { select: { ma: true } } } : {}) },
    }),
    napGD({ mon_id: { in: idsMon } }),
  ]);
  return { hs, gdMap };
}

/** Khối "Lớp tối nay" (nhẹ — tải trước): buổi hôm nay + buổi tối qua chưa điểm đủ tới 05:59. */
export async function lopToiNay(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const { buois, the, toiQua } = await napBuoi(u, luc, congNgay(h, -1), h);
  return [...toiQua(h).map((b) => ({ ...the(b), toi_qua: true })), ...buois.filter((b) => d2s(b.ngay) === h).map((b) => ({ ...the(b), toi_qua: false }))];
}

/** Khối "Lịch 7 ngày tới". */
export async function lich7Ngay(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const { buois, the } = await napBuoi(u, luc, h, congNgay(h, 6));
  return Array.from({ length: 7 }, (_, i) => congNgay(h, i)).map((ngay) => ({ ngay, buoi: buois.filter((b) => d2s(b.ngay) === ngay).map(the) }));
}

type ViecHN = { muc: number; loai: string; khoa: string; ngay: string | null; [k: string]: unknown };

/** Khối "Việc cần làm" (hom-nay.md Điều 3): việc đã đánh dấu xong bị ẩn (T33). Một hồ sơ bẩn chỉ thành việc "Sửa dữ liệu", không làm sập cả khối. */
export async function viecCanLam(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const chu = laChu(u);
  const h = ngayVN(luc);
  const thang = ngayTrongThang(thangCua(h));
  const { mons, tenMon, buois, td, chuaDu, toiQua } = await napBuoi(u, luc, [congNgay(h, -14), thang[0]].sort()[0], h);
  const { hs, gdMap } = await napHs(u, mons.map((m) => m.id));
  const viec: ViecHN[] = [];

  if (chu) {
    const don = await db.don_dang_ky.findMany({ where: { trang_thai: { in: ["moi", "cho_duyet"] } }, select: { id: true, ho_ten: true, thoi_gian: true, ghi_chu_xu_ly: true } });
    for (const d of don) viec.push({ muc: 1, loai: "don_cho_duyet", khoa: String(d.id), ngay: ngayVN(d.thoi_gian), don_id: d.id, ho_ten: d.ho_ten, ghi_chu: d.ghi_chu_xu_ly });
    for (const x of hs as (typeof hs[number] & { gmail: string | null; sdt_hs: string | null; sdt_ph: string | null; lua_id: number | null; lua: { ma: string } | null })[]) {
      try {
        viec.push(...viecCuaEm(x, gdMap.get(x.id) ?? [], h, tenMon));
      } catch (e) {
        console.error(`homNay: không tính được việc của ${x.ma_hs}`, e);
        viec.push({ muc: 6, loai: "sua_du_lieu", khoa: x.ma_hs, ngay: null, ma_hs: x.ma_hs, ho_ten: x.ho_ten, loi: ["loi_tinh"] });
      }
    }
  }

  // Mức 5: buổi chưa điểm danh (14 ngày trước hôm nay), em vắng nhiều (tháng này), buổi thiếu record (> 24 giờ sau khi xong)
  const toiQuaIds = new Set(toiQua(h).map((b) => b.id));
  for (const m of mons) {
    const chua = buois.filter((b) => b.mon_id === m.id && d2s(b.ngay) < h && d2s(b.ngay) >= congNgay(h, -14) && chuaDu(b) && !toiQuaIds.has(b.id));
    if (chua.length) viec.push({ muc: 5, loai: "buoi_chua_diem_danh", khoa: m.ma, ngay: d2s(chua[0].ngay), mon: tenMon.get(m.id), buoi: chua.map((b) => ({ id: b.id, ngay: d2s(b.ngay), thieu: td.get(b.id)!.si_so - td.get(b.id)!.da_diem })) });
    const thieuRec = buois.filter((b) => b.mon_id === m.id && b.trang_thai !== "huy" && !b.link_record && b.da_diem_danh_luc && luc.getTime() - b.da_diem_danh_luc.getTime() > 24 * 3600_000);
    if (thieuRec.length) viec.push({ muc: 5, loai: "buoi_thieu_record", khoa: m.ma, ngay: d2s(thieuRec[0].ngay), mon: tenMon.get(m.id), buoi: thieuRec.map((b) => ({ id: b.id, ngay: d2s(b.ngay) })) });
  }
  const buoiThang = buois.filter((b) => d2s(b.ngay) >= thang[0] && b.trang_thai !== "huy");
  const ddThang = await db.diem_danh.findMany({ where: { buoi_id: { in: buoiThang.map((b) => b.id) } }, select: { buoi_id: true, hoc_sinh_id: true, trang_thai: true } });
  const anHs = new Map(hs.map((x) => [x.id, x]));
  for (const m of mons) {
    const bm = new Map(buoiThang.filter((b) => b.mon_id === m.id).map((b) => [b.id, d2s(b.ngay)]));
    const vang = new Map<number, number>();
    for (const d of ddThang) {
      const ngay = bm.get(d.buoi_id);
      // chỉ tính bản ghi của em còn trong danh sách buổi (diem-danh.md 5.2)
      if (ngay && d.trang_thai === "vang" && (gdMap.get(d.hoc_sinh_id) ?? []).some((g) => g.mon_id === m.id && hieuLuc(g, ngay))) vang.set(d.hoc_sinh_id, (vang.get(d.hoc_sinh_id) ?? 0) + 1);
    }
    const em = [...vang].filter(([id, n]) => n >= 2 && anHs.has(id)).map(([id, n]) => ({ ma_hs: anHs.get(id)!.ma_hs, ho_ten: anHs.get(id)!.ho_ten, so_vang: n }));
    if (em.length) viec.push({ muc: 5, loai: "em_vang_nhieu", khoa: m.ma, ngay: null, mon: tenMon.get(m.id), em });
  }
  viec.sort((a, b) => a.muc - b.muc || (a.ngay ?? "9").localeCompare(b.ngay ?? "9"));
  // T33: ẩn việc đã đánh dấu xong (điều kiện hết đúng thì việc tự biến mất — 3.3)
  const xong = await db.viec_xong.findMany();
  const daAn = new Set(xong.filter((x) => conAn(x.loai, x.luc, h)).map((x) => `${x.loai}|${x.khoa}`));
  const hien = viec.filter((v) => !daAn.has(`${v.loai}|${v.khoa}`));
  return { viec: hien, so_viec_da_an: viec.length - hien.length };
}

/** Việc mức 2, 3, 6 của một em (chỉ chủ). Việc thử kèm lứa + SĐT HS cho tờ "Xử lý" (T27). */
function viecCuaEm(
  x: { ma_hs: string; ho_ten: string; gmail: string | null; sdt_hs: string | null; sdt_ph: string | null; lua_id: number | null; lua: { ma: string } | null },
  gds: GD[], h: string, tenMon: Map<number, unknown>,
): ViecHN[] {
  const ra: ViecHN[] = [];
  const lienHe = { lua: x.lua?.ma ?? null, sdt_hs: x.sdt_hs };
  const het = hetThu(gds, h);
  if (het) ra.push({ muc: 2, loai: "het_thu", khoa: x.ma_hs, ngay: het, ma_hs: x.ma_hs, ho_ten: x.ho_ten, ...lienHe, mon: monCua(gds.filter((g) => g.den === het && !g.huy && !g.nghi), tenMon) });
  const sap = thuSapHet(gds, h);
  if (sap) ra.push({ muc: 3, loai: "thu_sap_het", khoa: x.ma_hs, ngay: sap, ma_hs: x.ma_hs, ho_ten: x.ho_ten, ...lienHe, con_ngay: soNgayGiua(h, sap), mon: monCua(gds.filter((g) => g.loai === "thu" && hieuLuc(g, h)), tenMon) });
  const loi = [!gmailHopLe(chuanHoaGmail(x.gmail)) && "gmail", !sdtHopLe(x.sdt_hs) && !sdtHopLe(x.sdt_ph) && "sdt", x.lua_id === null && "lua"].filter(Boolean);
  if (loi.length) ra.push({ muc: 6, loai: "sua_du_lieu", khoa: x.ma_hs, ngay: null, ma_hs: x.ma_hs, ho_ten: x.ho_ten, loi });
  return ra;
}

/** Khối "Số liệu lớp". Chủ: thêm đếm đang học / đang thử / thử hết trong 3 ngày (đếm thật, không trừ việc đã ẩn) / lên chính thức tháng này. */
export async function theSo(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const h = ngayVN(luc);
  const thang = ngayTrongThang(thangCua(h));
  const { mons, tenMon, buois, td } = await napBuoi(u, luc, thang[0], h);
  const { hs, gdMap } = await napHs(u, mons.map((m) => m.id));
  const dangHieuLuc = (loai: "thu" | "chinh_thuc", monId?: number) =>
    hs.filter((x) => (gdMap.get(x.id) ?? []).some((g) => g.loai === loai && hieuLuc(g, h) && (monId === undefined || g.mon_id === monId)));
  const siSo = mons.map((m) => {
    const ct = new Set(dangHieuLuc("chinh_thuc", m.id).map((x) => x.id));
    return { mon: tenMon.get(m.id), chinh_thuc: ct.size, thu: dangHieuLuc("thu", m.id).filter((x) => !ct.has(x.id)).length };
  });
  const buoiThang = buois.filter((b) => b.trang_thai !== "huy");
  const coMat = mons.map((m) => {
    const ids = buoiThang.filter((b) => b.mon_id === m.id).map((b) => td.get(b.id)!);
    const co = ids.reduce((s, t) => s + t.co, 0), tong = ids.reduce((s, t) => s + t.co + t.phep + t.vang, 0);
    return { mon: tenMon.get(m.id), co, tong };
  });
  if (!laChu(u)) return { si_so: siSo, co_mat_thang: coMat };
  const ctIds = new Set(dangHieuLuc("chinh_thuc").map((x) => x.id));
  const an = (f: () => unknown) => { try { return f(); } catch { return null; } }; // hồ sơ bẩn không làm sập thẻ số
  return {
    dang_hoc_chinh_thuc: ctIds.size,
    dang_thu: dangHieuLuc("thu").filter((x) => !ctIds.has(x.id)).length,
    thu_het_3_ngay: hs.filter((x) => an(() => thuSapHet(gdMap.get(x.id) ?? [], h))).length,
    len_chinh_thuc_thang_nay: hs.filter((x) => {
      const dau = (gdMap.get(x.id) ?? []).filter((g) => g.loai === "chinh_thuc" && !g.huy).map((g) => g.tu).sort()[0];
      return dau && dau.slice(0, 7) === h.slice(0, 7);
    }).length,
    si_so: siSo, co_mat_thang: coMat,
  };
}

/** Cả màn Hôm nay trong một lần gọi (API cũ GET /api/hom-nay) — gọi 4 khối song song. */
export async function homNay(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const [lop, vc, so, lich] = await Promise.all([lopToiNay(u, luc), viecCanLam(u, luc), theSo(u, luc), lich7Ngay(u, luc)]);
  return { hom_nay: ngayVN(luc), vai: u.vai, lop_toi_nay: lop, viec: vc.viec, so_viec_da_an: vc.so_viec_da_an, the_so: so, lich_7_ngay: lich };
}

function monCua<T>(gds: { mon_id: number }[], ten: Map<number, T>) {
  return [...new Set(gds.map((g) => g.mon_id))].map((id) => ten.get(id)).filter(Boolean);
}

/** T33: chủ đánh dấu một việc là xong (ghi đè lần trước). */
export async function danhDauXong(u: Nguoi, loai: string, khoa: string, luc = new Date()) {
  canChu(u);
  if (!(loai in NGAY_AN_VIEC)) throw new LoiDuLieu(`Loại việc không hợp lệ: ${loai}`);
  if (!khoa || khoa.length > 100) throw new LoiDuLieu("Thiếu khoá việc");
  return db.$transaction(async (tx) => {
    const r = await tx.viec_xong.upsert({ where: { loai_khoa: { loai, khoa } }, create: { loai, khoa, nguoi_dung_id: u.id, luc }, update: { nguoi_dung_id: u.id, luc } });
    await ghiNhatKy(u, "danh_dau_xong", "viec", `${loai}|${khoa}`, null, { luc: r.luc.toISOString() }, tx);
    return { loai, khoa, an_den: congNgay(ngayVN(luc), NGAY_AN_VIEC[loai] - 1) };
  });
}

/** T33: bỏ đánh dấu (Hoàn tác) — việc hiện lại nếu điều kiện vẫn đúng. */
export async function boDanhDauXong(u: Nguoi, loai: string, khoa: string) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const r = await tx.viec_xong.deleteMany({ where: { loai, khoa } });
    if (!r.count) throw new LoiDuLieu("Việc này chưa được đánh dấu xong", 404);
    await ghiNhatKy(u, "bo_danh_dau_xong", "viec", `${loai}|${khoa}`, null, null, tx);
    return { loai, khoa };
  });
}
