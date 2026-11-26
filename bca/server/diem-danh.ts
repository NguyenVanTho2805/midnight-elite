// Điểm danh (diem-danh.md). Chủ + GV môn đó; kiểm quyền ở máy chủ cho từng request.
import { congNgay, d2s, ngayTrongThang, ngayVN, s2d, soNgayGiua } from "@/lib/ngay";
import { canMon, canQuanLy, LoiDuLieu, type Nguoi } from "@/lib/quyen";
import { chuoi, demDD, hieuLuc, loaiVaoNgay, moDiemDanh, qua48Gio, type GD, type TrangThaiDD } from "@/lib/quy-tac";
import { soTenViet } from "@/lib/chuan-hoa";
import { db, type Tx } from "./db";
import { napGD } from "./du-lieu";
import { ghiNhatKy } from "./nhat-ky";
import { tenNguoiDung } from "./hoc-sinh";

type BuoiMin = { id: number; mon_id: number; ngay: Date; trang_thai: "binh_thuong" | "huy" };
type EmBuoi = { hoc_sinh_id: number; loai: GD["loai"] };

/** diem-danh.md Điều 2: em có ghi danh môn còn hiệu lực vào ngày buổi; bỏ em ẩn trừ khi đã có bản ghi. */
export function dsEm(b: BuoiMin, gdMap: Map<number, GD[]>, anIds: Set<number>, coBanGhi: Set<number>): EmBuoi[] {
  if (b.trang_thai === "huy") return [];
  const ngay = d2s(b.ngay);
  const ra: EmBuoi[] = [];
  for (const [hsId, gds] of gdMap) {
    const loai = loaiVaoNgay(gds, b.mon_id, ngay);
    if (loai && (!anIds.has(hsId) || coBanGhi.has(hsId))) ra.push({ hoc_sinh_id: hsId, loai });
  }
  return ra;
}

/** Tiến độ nhiều buổi một lần (Hôm nay, danh sách buổi). */
export async function tienDo(buois: BuoiMin[], tx: Tx = db) {
  const monIds = [...new Set(buois.map((b) => b.mon_id))];
  const [gdMap, an, dd] = await Promise.all([
    napGD({ mon_id: { in: monIds } }, tx),
    tx.hoc_sinh.findMany({ where: { an_luc: { not: null } }, select: { id: true } }),
    tx.diem_danh.findMany({ where: { buoi_id: { in: buois.map((b) => b.id) } }, select: { buoi_id: true, hoc_sinh_id: true, trang_thai: true } }),
  ]);
  const anIds = new Set(an.map((x) => x.id));
  const ra = new Map<number, { si_so: number; chinh_thuc: number; thu: number; da_diem: number; co: number; phep: number; vang: number }>();
  for (const b of buois) {
    const ghi = new Map(dd.filter((d) => d.buoi_id === b.id).map((d) => [d.hoc_sinh_id, d.trang_thai]));
    const ds = dsEm(b, gdMap, anIds, new Set(ghi.keys()));
    const tt = ds.map((e) => ghi.get(e.hoc_sinh_id));
    ra.set(b.id, {
      si_so: ds.length, chinh_thuc: ds.filter((e) => e.loai === "chinh_thuc").length, thu: ds.filter((e) => e.loai === "thu").length,
      da_diem: tt.filter(Boolean).length, ...demDD(tt),
    });
  }
  return ra;
}

async function napBuoi(u: Nguoi, buoiId: number, tx: Tx = db) {
  canQuanLy(u);
  const b = await tx.buoi_hoc.findUnique({ where: { id: buoiId }, include: { mon: true } });
  if (!b) throw new LoiDuLieu("Không có buổi này", 404);
  canMon(u, b.mon_id);
  return b;
}

async function emCuaBuoi(b: BuoiMin, tx: Tx) {
  const [gdMap, an, dd] = await Promise.all([
    napGD({ mon_id: { in: [b.mon_id] } }, tx),
    tx.hoc_sinh.findMany({ where: { an_luc: { not: null } }, select: { id: true } }),
    tx.diem_danh.findMany({ where: { buoi_id: b.id } }),
  ]);
  return { gdMap, dd, ds: dsEm(b, gdMap, new Set(an.map((x) => x.id)), new Set(dd.map((d) => d.hoc_sinh_id))) };
}

/** Đặt da_diem_danh_luc khi đủ; bỏ khi không còn đủ (hoàn tác, về chưa điểm). */
async function capNhatXong(tx: Tx, b: BuoiMin & { da_diem_danh_luc: Date | null }, luc: Date) {
  const { ds, dd } = await emCuaBuoi(b, tx);
  const co = new Set(dd.map((d) => d.hoc_sinh_id));
  const du = ds.length > 0 && ds.every((e) => co.has(e.hoc_sinh_id));
  if (du && !b.da_diem_danh_luc) await tx.buoi_hoc.update({ where: { id: b.id }, data: { da_diem_danh_luc: luc } });
  if (!du && b.da_diem_danh_luc) await tx.buoi_hoc.update({ where: { id: b.id }, data: { da_diem_danh_luc: null } });
  return { si_so: ds.length, da_diem: ds.filter((e) => co.has(e.hoc_sinh_id)).length, xong: du };
}

function kiemGhi(b: { bat_dau_luc: Date; trang_thai: string }, luc: Date, xacNhan?: boolean) {
  if (b.trang_thai === "huy") throw new LoiDuLieu("Buổi này nghỉ — không điểm danh", 409, "buoi_huy");
  if (!moDiemDanh(b.bat_dau_luc, luc)) throw new LoiDuLieu("Chưa tới giờ điểm danh (mở từ 30 phút trước giờ học)", 409, "chua_mo");
  if (qua48Gio(b.bat_dau_luc, luc) && !xacNhan) throw new LoiDuLieu("Buổi đã qua 48 giờ — cần xác nhận để sửa", 409, "can_xac_nhan_48h");
}

export async function chiTietDiemDanh(u: Nguoi, buoiId: number, luc = new Date()) {
  const b = await napBuoi(u, buoiId);
  const { gdMap, dd, ds } = await emCuaBuoi(b, db);
  const ngay = d2s(b.ngay);
  const h = ngayVN(luc);
  const hs = await db.hoc_sinh.findMany({ where: { id: { in: ds.map((e) => e.hoc_sinh_id) } }, select: { id: true, ma_hs: true, ho_ten: true } });
  const ten = await tenNguoiDung(dd.map((d) => d.ghi_boi));
  const ghi = new Map(dd.map((d) => [d.hoc_sinh_id, d]));
  const em = hs
    .map((x) => {
      const gds = gdMap.get(x.id)!;
      const e = ds.find((d) => d.hoc_sinh_id === x.id)!;
      const thuDen = e.loai === "thu" ? gds.find((g) => g.mon_id === b.mon_id && g.loai === "thu" && hieuLuc(g, ngay))?.den ?? null : null;
      const r = ghi.get(x.id);
      return {
        hoc_sinh_id: x.id, ma_hs: x.ma_hs, ho_ten: x.ho_ten, loai: e.loai,
        thu_den: thuDen, thu_con_ngay: thuDen ? soNgayGiua(h, thuDen) : null,
        trang_thai: r?.trang_thai ?? null, ghi_chu: r?.ghi_chu ?? null, ghi_luc: r?.ghi_luc ?? null, ghi_boi: r ? (ten.get(r.ghi_boi ?? "") ?? (r.nguon === "sheet" ? "Sheet" : null)) : null,
      };
    })
    .sort((a, c) => soTenViet(a.ho_ten, c.ho_ten));
  // Em hết thử trong 7 ngày trước buổi, không còn tên (man-diem-danh §3 dòng cuối).
  const hetThu = [...gdMap.entries()]
    .filter(([id, gds]) => !ds.some((d) => d.hoc_sinh_id === id) && gds.some((g) => g.mon_id === b.mon_id && g.loai === "thu" && !g.huy && g.den! < ngay && g.den! >= congNgay(ngay, -7)))
    .map(([, gds]) => gds.filter((g) => g.mon_id === b.mon_id && g.loai === "thu").map((g) => g.den!).sort().at(-1)!);
  return {
    buoi: {
      id: b.id, mon: { ma: b.mon.ma, ten: b.mon.ten_ngan }, ngay, bat_dau_luc: b.bat_dau_luc, so_phut: b.so_phut, loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy,
      noi_dung: b.noi_dung, link_record: b.link_record, da_diem_danh_luc: b.da_diem_danh_luc,
    },
    trang_thai_ghi: b.trang_thai === "huy" ? "huy" : !moDiemDanh(b.bat_dau_luc, luc) ? (ngay > h ? "tuong_lai" : "chua_mo") : qua48Gio(b.bat_dau_luc, luc) ? "qua_48h" : "mo",
    dem: { chua_diem: em.filter((e) => !e.trang_thai).length, ...demDD(em.map((e) => e.trang_thai)) },
    em,
    het_thu_khong_co_ten: { so_em: hetThu.length, ngay: [...new Set(hetThu)].sort() },
  };
}

/** Đặt / đổi / về chưa điểm (trangThai = null) và/hoặc ghi chú (T25) cho một em. Bản ghi sau thắng (phan-quyen 2.3). */
export async function datDiemDanh(u: Nguoi, buoiId: number, hocSinhId: number, v: { trangThai?: TrangThaiDD | null; ghiChu?: string | null; xacNhan?: boolean }, luc = new Date()) {
  if (v.trangThai !== undefined && v.trangThai !== null && !["co", "phep", "vang"].includes(v.trangThai)) throw new LoiDuLieu("Trạng thái phải là co, phep hoặc vang");
  if (v.trangThai === undefined && v.ghiChu === undefined) throw new LoiDuLieu("Không có gì để lưu");
  const ghiChu = v.ghiChu === undefined ? undefined : v.ghiChu?.trim() || null;
  if (ghiChu && ghiChu.length > 500) throw new LoiDuLieu("Ghi chú tối đa 500 ký tự");
  return db.$transaction(async (tx) => {
    const b = await napBuoi(u, buoiId, tx);
    kiemGhi(b, luc, v.xacNhan);
    const { ds, dd } = await emCuaBuoi(b, tx);
    if (!ds.some((e) => e.hoc_sinh_id === hocSinhId)) throw new LoiDuLieu("Em không có tên trong buổi này", 409, "khong_trong_buoi");
    const cu = dd.find((d) => d.hoc_sinh_id === hocSinhId) ?? null;
    const khoa = { buoi_id_hoc_sinh_id: { buoi_id: buoiId, hoc_sinh_id: hocSinhId } };
    const ghiBoi = u.vai === "hoc_sinh" ? null : u.id;
    let moi = null;
    if (v.trangThai === null) {
      if (cu) await tx.diem_danh.delete({ where: khoa });
    } else if (v.trangThai) {
      moi = await tx.diem_danh.upsert({
        where: khoa,
        create: { buoi_id: buoiId, hoc_sinh_id: hocSinhId, trang_thai: v.trangThai, ghi_chu: ghiChu ?? null, ghi_luc: luc, ghi_boi: ghiBoi, nguon: "web" },
        update: { trang_thai: v.trangThai, ...(ghiChu !== undefined ? { ghi_chu: ghiChu } : {}), ghi_luc: luc, ghi_boi: ghiBoi, nguon: "web" },
      });
    } else {
      if (!cu) throw new LoiDuLieu("Điểm danh em trước rồi mới ghi chú", 409, "chua_diem");
      moi = await tx.diem_danh.update({ where: khoa, data: { ghi_chu: ghiChu } });
    }
    await ghiNhatKy(u, "diem_danh", "diem_danh", `${buoiId}:${hocSinhId}`, cu && { trang_thai: cu.trang_thai, ghi_chu: cu.ghi_chu }, moi && { trang_thai: moi.trang_thai, ghi_chu: moi.ghi_chu, qua_48h_xac_nhan: !!v.xacNhan }, tx);
    return { ban_ghi: moi, tien_do: await capNhatXong(tx, b, luc) };
  });
}

/** diem-danh.md 3.2: đặt Có cho mọi em CHƯA có bản ghi; trả {ids, luc} để hoàn tác. */
export async function danhTatCaCoMat(u: Nguoi, buoiId: number, opt: { xacNhan?: boolean } = {}, luc = new Date()) {
  return db.$transaction(async (tx) => {
    const b = await napBuoi(u, buoiId, tx);
    kiemGhi(b, luc, opt.xacNhan);
    const { ds, dd } = await emCuaBuoi(b, tx);
    const co = new Set(dd.map((d) => d.hoc_sinh_id));
    const ids = ds.map((e) => e.hoc_sinh_id).filter((id) => !co.has(id));
    const ghiBoi = u.vai === "hoc_sinh" ? null : u.id;
    await tx.diem_danh.createMany({ data: ids.map((hoc_sinh_id) => ({ buoi_id: buoiId, hoc_sinh_id, trang_thai: "co" as const, ghi_luc: luc, ghi_boi: ghiBoi, nguon: "web" as const })) });
    await ghiNhatKy(u, "danh_tat_ca_co_mat", "buoi_hoc", buoiId, null, { hoc_sinh_ids: ids, luc: luc.toISOString() }, tx);
    return { ids, luc: luc.toISOString(), tien_do: await capNhatXong(tx, b, luc) };
  });
}

/** Hoàn tác "đánh tất cả": chỉ trả về chưa điểm các em lần đó đặt Có và chưa bị sửa sau đó. */
export async function hoanTacTatCa(u: Nguoi, buoiId: number, ids: number[], lucStr: string, luc = new Date()) {
  const lucDanh = new Date(lucStr);
  if (isNaN(lucDanh.getTime()) || !Array.isArray(ids)) throw new LoiDuLieu("Thiếu ids hoặc luc");
  return db.$transaction(async (tx) => {
    const b = await napBuoi(u, buoiId, tx);
    const r = await tx.diem_danh.deleteMany({
      where: { buoi_id: buoiId, hoc_sinh_id: { in: ids.map(Number) }, trang_thai: "co", ghi_luc: lucDanh, ghi_boi: u.vai === "hoc_sinh" ? null : u.id },
    });
    await ghiNhatKy(u, "hoan_tac_tat_ca", "buoi_hoc", buoiId, { hoc_sinh_ids: ids, luc: lucStr }, { so_tra_lai: r.count }, tx);
    return { so_tra_lai: r.count, tien_do: await capNhatXong(tx, b, luc) };
  });
}

/** Ma trận tháng một môn (man-diem-danh §7). Ô: co | phep | vang | null (chưa điểm) | "-" (không học ngày này) | "huy". */
export async function maTranThang(u: Nguoi, monMa: string, thang: string, luc = new Date()) {
  canQuanLy(u);
  const mon = await db.mon.findUnique({ where: { ma: monMa } });
  if (!mon) throw new LoiDuLieu(`Không có môn ${monMa}`, 404);
  canMon(u, mon.id);
  const ngays = ngayTrongThang(thang);
  const buois = await db.buoi_hoc.findMany({
    where: { mon_id: mon.id, ngay: { gte: s2d(ngays[0]), lte: s2d(ngays.at(-1)!) } },
    orderBy: { bat_dau_luc: "asc" },
    include: { diem_danh: { select: { hoc_sinh_id: true, trang_thai: true } } },
  });
  const gdMap = await napGD({ mon_id: { in: [mon.id] } });
  const an = new Set((await db.hoc_sinh.findMany({ where: { an_luc: { not: null } }, select: { id: true } })).map((x) => x.id));
  const h = ngayVN(luc);
  const hang: { hoc_sinh_id: number; o: (TrangThaiDD | null | "-" | "huy")[]; loai: GD["loai"]; dang_hoc: boolean }[] = [];
  for (const [hsId, gds] of gdMap) {
    const o = buois.map((b) => {
      if (b.trang_thai === "huy") return "huy" as const;
      const ngay = d2s(b.ngay);
      const r = b.diem_danh.find((d) => d.hoc_sinh_id === hsId);
      if (!loaiVaoNgay(gds, mon.id, ngay) || (an.has(hsId) && !r)) return "-" as const;
      return r?.trang_thai ?? null;
    });
    if (o.every((x) => x === "-" || x === "huy")) continue;
    const coCT = buois.some((b) => loaiVaoNgay(gds, mon.id, d2s(b.ngay)) === "chinh_thuc");
    hang.push({ hoc_sinh_id: hsId, o, loai: coCT ? "chinh_thuc" : "thu", dang_hoc: !an.has(hsId) && gds.some((g) => g.mon_id === mon.id && hieuLuc(g, h)) });
  }
  const hs = await db.hoc_sinh.findMany({ where: { id: { in: hang.map((x) => x.hoc_sinh_id) } }, select: { id: true, ma_hs: true, ho_ten: true } });
  const tenHs = new Map(hs.map((x) => [x.id, x]));
  return {
    mon: { ma: mon.ma, ten: mon.ten_ngan }, thang, hom_nay: h,
    buoi: buois.map((b) => ({ id: b.id, ngay: d2s(b.ngay), bat_dau_luc: b.bat_dau_luc, loai: b.loai, trang_thai: b.trang_thai })),
    hang: hang
      .map((x) => {
        const tt = x.o.map((v) => (v === "-" || v === "huy" ? null : v));
        const c = demDD(tt);
        return { ...x, ma_hs: tenHs.get(x.hoc_sinh_id)!.ma_hs, ho_ten: tenHs.get(x.hoc_sinh_id)!.ho_ten, ...c, co_mat: `${c.co}/${c.co + c.phep + c.vang}`, chuoi: chuoi(tt) };
      })
      .sort((a, b) => soTenViet(a.ho_ten, b.ho_ten)),
  };
}
