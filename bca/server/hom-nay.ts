// Màn Hôm nay (hom-nay.md), lọc theo vai ở máy chủ (Điều 6).
import { congNgay, d2s, gioVN, ngayTrongThang, ngayVN, s2d, soNgayGiua, thangCua } from "@/lib/ngay";
import { canChu, canQuanLy, laChu, LoiDuLieu, monXemDuoc, type Nguoi } from "@/lib/quyen";
import { conGioBuoiToiQua, hetThu, hieuLuc, moDiemDanh, thuSapHet } from "@/lib/quy-tac";
import { chuanHoaGmail, gmailHopLe, sdtHopLe } from "@/lib/chuan-hoa";
import { db } from "./db";
import { napGD, napMon } from "./du-lieu";
import { tienDo } from "./diem-danh";
import { ghiNhatKy } from "./nhat-ky";

/** Loại việc → số ngày ẩn khi đánh dấu xong (hom-nay.md 3.3: học thử 3 ngày, việc khác hết hôm nay). */
export const NGAY_AN_VIEC: Record<string, number> = {
  don_cho_duyet: 1, het_thu: 3, thu_sap_het: 3, buoi_chua_diem_danh: 1, em_vang_nhieu: 1, buoi_thieu_record: 1, sua_du_lieu: 1,
};
/** Còn ẩn vào ngày h không (đánh dấu lúc `luc`, tính theo ngày giờ Việt Nam). */
export const conAn = (loai: string, luc: Date, h: string) => h <= congNgay(ngayVN(luc), (NGAY_AN_VIEC[loai] ?? 1) - 1);

export async function homNay(u: Nguoi, luc = new Date()) {
  canQuanLy(u);
  const chu = laChu(u);
  const h = ngayVN(luc);
  const monIds = monXemDuoc(u);
  const mons = (await napMon()).filter((m) => !monIds || monIds.includes(m.id));
  const idsMon = mons.map((m) => m.id);
  const tenMon = new Map(mons.map((m) => [m.id, { ma: m.ma, ten: m.ten_ngan }]));
  const thang = ngayTrongThang(thangCua(h));
  const tu = [congNgay(h, -14), thang[0]].sort()[0];

  const buois = await db.buoi_hoc.findMany({
    where: { mon_id: { in: idsMon }, ngay: { gte: s2d(tu), lte: s2d(congNgay(h, 6)) } },
    orderBy: { bat_dau_luc: "asc" },
  });
  const td = await tienDo(buois);
  const the = (b: (typeof buois)[number]) => {
    const t = td.get(b.id)!;
    return {
      id: b.id, mon: tenMon.get(b.mon_id), ngay: d2s(b.ngay), gio: `${gioVN(b.bat_dau_luc)}–${gioVN(new Date(b.bat_dau_luc.getTime() + b.so_phut * 60_000))}`,
      loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy, chinh_thuc: t.chinh_thuc, thu: t.thu, si_so: t.si_so, da_diem: t.da_diem,
      mo_diem_danh: b.trang_thai !== "huy" && moDiemDanh(b.bat_dau_luc, luc), co_record: !!b.link_record,
    };
  };
  const chuaDu = (b: (typeof buois)[number]) => b.trang_thai !== "huy" && td.get(b.id)!.da_diem < td.get(b.id)!.si_so;

  const toiQua = conGioBuoiToiQua(luc) ? buois.filter((b) => d2s(b.ngay) === congNgay(h, -1) && chuaDu(b)) : [];
  const lopToiNay = [...toiQua.map((b) => ({ ...the(b), toi_qua: true })), ...buois.filter((b) => d2s(b.ngay) === h).map((b) => ({ ...the(b), toi_qua: false }))];

  // Học sinh + ghi danh (GV: chỉ môn mình; cột theo vai)
  const hs = await db.hoc_sinh.findMany({
    where: { an_luc: null },
    select: { id: true, ma_hs: true, ho_ten: true, ...(chu ? { gmail: true, sdt_hs: true, sdt_ph: true, lua_id: true } : {}) },
  });
  const gdMap = await napGD({ mon_id: { in: idsMon } });
  const viec: { muc: number; loai: string; khoa: string; ngay: string | null; [k: string]: unknown }[] = [];

  if (chu) {
    const don = await db.don_dang_ky.findMany({ where: { trang_thai: { in: ["moi", "cho_duyet"] } }, select: { id: true, ho_ten: true, thoi_gian: true, ghi_chu_xu_ly: true } });
    for (const d of don) viec.push({ muc: 1, loai: "don_cho_duyet", khoa: String(d.id), ngay: ngayVN(d.thoi_gian), don_id: d.id, ho_ten: d.ho_ten, ghi_chu: d.ghi_chu_xu_ly });
    for (const x of hs) {
      const gds = gdMap.get(x.id) ?? [];
      const het = hetThu(gds, h);
      if (het) viec.push({ muc: 2, loai: "het_thu", khoa: x.ma_hs, ngay: het, ma_hs: x.ma_hs, ho_ten: x.ho_ten, mon: monCua(gds.filter((g) => g.den === het && !g.huy && !g.nghi), tenMon) });
      const sap = thuSapHet(gds, h);
      if (sap) viec.push({ muc: 3, loai: "thu_sap_het", khoa: x.ma_hs, ngay: sap, ma_hs: x.ma_hs, ho_ten: x.ho_ten, con_ngay: soNgayGiua(h, sap), mon: monCua(gds.filter((g) => g.loai === "thu" && hieuLuc(g, h)), tenMon) });
      const x2 = x as typeof x & { gmail: string | null; sdt_hs: string | null; sdt_ph: string | null; lua_id: number | null };
      const loi = [
        !gmailHopLe(chuanHoaGmail(x2.gmail)) && "gmail",
        !sdtHopLe(x2.sdt_hs) && !sdtHopLe(x2.sdt_ph) && "sdt",
        x2.lua_id === null && "lua",
      ].filter(Boolean);
      if (loi.length) viec.push({ muc: 6, loai: "sua_du_lieu", khoa: x.ma_hs, ngay: null, ma_hs: x.ma_hs, ho_ten: x.ho_ten, loi });
    }
  }

  // Mức 5: buổi chưa điểm danh (14 ngày trước hôm nay), em vắng nhiều (tháng này), buổi thiếu record (> 24 giờ sau khi xong)
  const toiQuaIds = new Set(toiQua.map((b) => b.id));
  for (const m of mons) {
    const chua = buois.filter((b) => b.mon_id === m.id && d2s(b.ngay) < h && d2s(b.ngay) >= congNgay(h, -14) && chuaDu(b) && !toiQuaIds.has(b.id));
    if (chua.length) viec.push({ muc: 5, loai: "buoi_chua_diem_danh", khoa: m.ma, ngay: d2s(chua[0].ngay), mon: tenMon.get(m.id), buoi: chua.map((b) => ({ id: b.id, ngay: d2s(b.ngay), thieu: td.get(b.id)!.si_so - td.get(b.id)!.da_diem })) });
    const thieuRec = buois.filter((b) => b.mon_id === m.id && b.trang_thai !== "huy" && !b.link_record && b.da_diem_danh_luc && luc.getTime() - b.da_diem_danh_luc.getTime() > 24 * 3600_000);
    if (thieuRec.length) viec.push({ muc: 5, loai: "buoi_thieu_record", khoa: m.ma, ngay: d2s(thieuRec[0].ngay), mon: tenMon.get(m.id), buoi: thieuRec.map((b) => ({ id: b.id, ngay: d2s(b.ngay) })) });
  }
  const buoiThang = buois.filter((b) => d2s(b.ngay) >= thang[0] && d2s(b.ngay) <= h && b.trang_thai !== "huy");
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
  const soSapHet = viec.filter((v) => v.loai === "thu_sap_het").length; // thẻ số đếm thật, không trừ việc đã ẩn
  // T33: ẩn việc đã đánh dấu xong (điều kiện hết đúng thì việc tự biến mất — 3.3)
  const xong = await db.viec_xong.findMany();
  const daAn = new Set(xong.filter((x) => conAn(x.loai, x.luc, h)).map((x) => `${x.loai}|${x.khoa}`));
  const hien = viec.filter((v) => !daAn.has(`${v.loai}|${v.khoa}`));

  // Thẻ số liệu
  const dangHieuLuc = (loai: "thu" | "chinh_thuc", monId?: number) =>
    hs.filter((x) => (gdMap.get(x.id) ?? []).some((g) => g.loai === loai && hieuLuc(g, h) && (monId === undefined || g.mon_id === monId)));
  const siSo = mons.map((m) => {
    const ct = new Set(dangHieuLuc("chinh_thuc", m.id).map((x) => x.id));
    return { mon: tenMon.get(m.id), chinh_thuc: ct.size, thu: dangHieuLuc("thu", m.id).filter((x) => !ct.has(x.id)).length };
  });
  const coMat = mons.map((m) => {
    const ids = buoiThang.filter((b) => b.mon_id === m.id).map((b) => td.get(b.id)!);
    const co = ids.reduce((s, t) => s + t.co, 0), tong = ids.reduce((s, t) => s + t.co + t.phep + t.vang, 0);
    return { mon: tenMon.get(m.id), co, tong };
  });
  const ctIds = new Set(dangHieuLuc("chinh_thuc").map((x) => x.id));
  const theSo = chu
    ? {
        dang_hoc_chinh_thuc: ctIds.size,
        dang_thu: dangHieuLuc("thu").filter((x) => !ctIds.has(x.id)).length,
        thu_het_3_ngay: soSapHet,
        len_chinh_thuc_thang_nay: hs.filter((x) => {
          const dau = (gdMap.get(x.id) ?? []).filter((g) => g.loai === "chinh_thuc" && !g.huy).map((g) => g.tu).sort()[0];
          return dau && dau.slice(0, 7) === h.slice(0, 7);
        }).length,
        si_so: siSo, co_mat_thang: coMat,
      }
    : { si_so: siSo, co_mat_thang: coMat };

  const lich7 = Array.from({ length: 7 }, (_, i) => congNgay(h, i)).map((ngay) => ({ ngay, buoi: buois.filter((b) => d2s(b.ngay) === ngay).map(the) }));
  return { hom_nay: h, vai: u.vai, lop_toi_nay: lopToiNay, viec: hien, so_viec_da_an: viec.length - hien.length, the_so: theSo, lich_7_ngay: lich7 };
}

function monCua(gds: { mon_id: number }[], ten: Map<number, { ma: string; ten: string }>) {
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
