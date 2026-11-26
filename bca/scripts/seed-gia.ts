// Sinh dữ liệu GIẢ đủ ca cho test và máy dev. KHÔNG có dữ liệu thật nào.
// Chạy: BCA_DATABASE_URL=postgresql://…/bca_test npx tsx scripts/seed-gia.ts
// Xoá sạch mọi bảng trước khi sinh → chỉ chạy trên DB cục bộ (localhost) hoặc khi BCA_CHO_PHEP_XOA=1.
import { congNgay, d2s, lucVN, s2d } from "../lib/ngay";
import { buoiTheoLich, hieuLuc, type GD } from "../lib/quy-tac";
import type { PrismaClient } from "../generated/prisma/client";

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ"];
const DEM = ["Minh", "Thu", "Gia", "Ngọc", "Đức", "Khánh", "Thanh", "Hải", "Bảo", "Phương"];
const TEN = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khoa", "Linh", "My", "Nam", "Oanh", "Phúc", "Quân"];

export const MON = [
  { id: 1, ma: "toan", ten_ngan: "Toán", ten_day_du: "Toán", thu: [2, 6], thu_tu: 1 },
  { id: 2, ma: "su", ten_ngan: "Sử", ten_day_du: "Lịch sử", thu: [3, 7], thu_tu: 2 },
  { id: 3, ma: "dia", ten_ngan: "Địa", ten_day_du: "Địa lí", thu: [5], thu_tu: 3 },
  { id: 4, ma: "anh", ten_ngan: "Anh", ten_day_du: "Tiếng Anh", thu: [1, 4], thu_tu: 4 },
];
export const NGUOI_THU = [
  { gmail: "chu.thu@bca.invalid", ten_hien_thi: "Chủ lớp (thử)", vai_tro: "chu" as const, mon: [] as string[] },
  { gmail: "gv.toan@bca.invalid", ten_hien_thi: "GV Toán (thử)", vai_tro: "giao_vien" as const, mon: ["toan"] },
  { gmail: "gv.anh@bca.invalid", ten_hien_thi: "GV Anh (thử)", vai_tro: "giao_vien" as const, mon: ["anh"] },
];
/** Ngày "hôm nay" mà bộ dữ liệu giả mô phỏng (giống bản xuất sheet). */
export const HOM_NAY_GIA = "2026-11-26";

const bam = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function xoaHet(db: PrismaClient) {
  await db.$executeRawUnsafe(
    `TRUNCATE nhat_ky, diem_danh, buoi_hoc, ghi_danh, don_dang_ky, hoc_sinh, phan_cong, nguoi_dung, mon, lua, cai_dat, bo_dem RESTART IDENTITY CASCADE`,
  );
}

export async function seedGia(db: PrismaClient) {
  await xoaHet(db);
  await db.lua.createMany({
    data: [
      { ma: "L1", ten: "Lứa 1 – thử", tu_ngay: s2d("2026-06-01"), den_ngay: s2d("2026-10-31") },
      { ma: "L2", ten: "Lứa 2 – thử", tu_ngay: s2d("2026-11-01") },
    ],
  });
  const [l1, l2] = await db.lua.findMany({ orderBy: { ma: "asc" } });
  await db.mon.createMany({ data: MON });
  await db.cai_dat.createMany({
    data: [
      { khoa: "SO_NGAY_HOC_THU", gia_tri: 14 },
      { khoa: "NGAY_BAT_DAU_TINH_PHI", gia_tri: "2026-11-16" },
      { khoa: "GIA_1_MON", gia_tri: 65000 },
      { khoa: "GIA_TU_2_MON", gia_tri: 55000 },
    ],
  });
  for (const n of NGUOI_THU) {
    const nd = await db.nguoi_dung.create({ data: { gmail: n.gmail, ten_hien_thi: n.ten_hien_thi, vai_tro: n.vai_tro } });
    for (const ma of n.mon) await db.phan_cong.create({ data: { nguoi_dung_id: nd.id, mon_id: MON.find((m) => m.ma === ma)!.id } });
  }

  // 70 em. Nhóm theo chỉ số i:
  //  0–19 chính thức (L1, từ 30/06), 1–2 môn; em 0–1 thử thêm môn khác
  //  20–59 thử còn hạn ngày 26/11 (đăng ký 15–25/11 → hết 28/11–08/12)
  //  60–64 hết thử (đăng ký 01–05/11 → hết 14–18/11), chưa ai xử lý
  //  65–67 thử 10/11–23/11 rồi chính thức từ 24/11
  //  68 đã nghỉ (chủ cho nghỉ đến hết 20/11) · 69 đã ẩn hồ sơ
  const gd: { hoc_sinh_id: number; mon_id: number; loai: "thu" | "chinh_thuc"; tu: string; den: string | null; ghi_chu?: string }[] = [];
  const don: { i: number; ngay: string; mon: number[]; loai: string; trang_thai: "da_nhan" | "cho_duyet" }[] = [];
  for (let i = 0; i < 70; i++) {
    const ten = `${HO[i % 10]} ${DEM[(i * 3) % 10]} ${TEN[i % 13]}`;
    const ngayTao = i < 20 || i >= 68 ? "2026-06-30" : i < 60 ? congNgay("2026-11-15", (i - 20) % 11) : i < 65 ? congNgay("2026-11-01", i - 60) : "2026-11-10";
    const hs = await db.hoc_sinh.create({
      data: {
        ma_hs: `HS${String(i + 1).padStart(4, "0")}`, ho_ten: ten, lua_id: ngayTao < "2026-11-01" ? l1.id : l2.id,
        sdt_hs: `09${String(10000000 + i).padStart(8, "0")}`, sdt_ph: i % 3 === 0 ? `08${String(20000000 + i).padStart(8, "0")}` : null,
        ho_ten_ph: i % 3 === 0 ? `Phụ huynh ${i + 1}` : null,
        gmail: i === 7 ? `hs${i + 1}@gamil.com` : `hs${i + 1}@example.com`, // em 8: gõ nhầm đuôi → "Sửa dữ liệu"
        truong: "THPT Thử nghiệm", khoi: "Khối 12 (2K9)", username_azota: `hs${String(i + 1).padStart(4, "0")}`,
        ngay_tao: s2d(ngayTao), ghi_chu_rieng: i % 5 === 0 ? "Ghi chú riêng của chủ (giả)" : null,
        an_luc: i === 69 ? new Date("2026-11-20T10:00:00Z") : null,
      },
    });
    const id = hs.id;
    if (i < 20 || i >= 68) {
      const mons = i % 3 === 0 ? [1, 2] : i % 3 === 1 ? [4] : [1, 3, 4];
      for (const m of mons) gd.push({ hoc_sinh_id: id, mon_id: m, loai: "chinh_thuc", tu: "2026-06-30", den: i === 68 ? "2026-11-20" : null, ghi_chu: i === 68 ? "Cho nghỉ đến hết 20/11" : undefined });
      if (i < 2) gd.push({ hoc_sinh_id: id, mon_id: i === 0 ? 3 : 1, loai: "thu", tu: "2026-11-20", den: "2026-12-03" });
    } else if (i < 60) {
      const mons = [[1, 2], [4], [1, 4], [2, 3, 4]][i % 4];
      for (const m of mons) gd.push({ hoc_sinh_id: id, mon_id: m, loai: "thu", tu: ngayTao, den: congNgay(ngayTao, 13) });
      don.push({ i: id, ngay: ngayTao, mon: mons, loai: "Học thử", trang_thai: "da_nhan" });
    } else if (i < 65) {
      for (const m of [1, 4]) gd.push({ hoc_sinh_id: id, mon_id: m, loai: "thu", tu: ngayTao, den: congNgay(ngayTao, 13) });
    } else {
      gd.push({ hoc_sinh_id: id, mon_id: 2, loai: "thu", tu: "2026-11-10", den: "2026-11-23" });
      gd.push({ hoc_sinh_id: id, mon_id: 2, loai: "chinh_thuc", tu: "2026-11-24", den: null, ghi_chu: "Lên chính thức sớm từ 24/11" });
    }
  }
  for (const [k, g] of gd.entries())
    await db.ghi_danh.create({ data: { ma_gd: `GD${String(k + 1).padStart(5, "0")}`, hoc_sinh_id: g.hoc_sinh_id, mon_id: g.mon_id, loai: g.loai, tu_ngay: s2d(g.tu), den_ngay: g.den ? s2d(g.den) : null, ghi_chu: g.ghi_chu } });
  await db.bo_dem.createMany({ data: [{ khoa: "hs", gia_tri: 83 }, { khoa: "gd", gia_tri: gd.length + 19 }] });

  don.push({ i: 0, ngay: "2026-11-25", mon: [1], loai: "Học thử", trang_thai: "cho_duyet" });
  for (const [k, d] of don.entries())
    await db.don_dang_ky.create({
      data: {
        thoi_gian: lucVN(d.ngay, "20:00"), nguon: "Web", loai: d.loai, ho_ten: d.i ? `Đơn của em ${d.i}` : "Đơn chờ duyệt (giả)", mon_ids: d.mon,
        ma_yeu_cau: `YC${String(k + 1).padStart(4, "0")}`, trang_thai: d.trang_thai, hoc_sinh_id: d.i || null, loi_du_lieu: [],
      },
    });

  // Buổi 16/11–31/12 theo lịch (46), huỷ Sử 09/12, học bù Sử 13/12 lúc 20:00.
  for (const thang of ["2026-11", "2026-12"])
    await db.buoi_hoc.createMany({ data: buoiTheoLich(MON.map((m) => ({ ...m, gio_bat_dau: "22:15", so_phut: 90 })), thang, "2026-11-16").map((b) => ({ ...b, ngay: s2d(b.ngay) })) });
  const huy = await db.buoi_hoc.update({ where: { mon_id_bat_dau_luc: { mon_id: 2, bat_dau_luc: lucVN("2026-12-09", "22:15") } }, data: { trang_thai: "huy", ly_do_huy: "GV ốm (giả)" } });
  await db.buoi_hoc.create({ data: { mon_id: 2, ngay: s2d("2026-12-13"), bat_dau_luc: lucVN("2026-12-13", "20:00"), so_phut: 90, loai: "hoc_bu", bu_cho_buoi_id: huy.id } });

  // Điểm danh các buổi trước 26/11, trừ Toán 24/11 và Anh 23/11 (để có "Buổi chưa điểm danh").
  const gdMap = new Map<number, GD[]>();
  for (const g of gd) gdMap.set(g.hoc_sinh_id, [...(gdMap.get(g.hoc_sinh_id) ?? []), { ...g, huy: false }]);
  const anId = (await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0070" } })).id;
  const buois = await db.buoi_hoc.findMany({ where: { ngay: { lt: s2d(HOM_NAY_GIA) } }, orderBy: { bat_dau_luc: "asc" } });
  for (const b of buois) {
    const ngay = d2s(b.ngay);
    if ((b.mon_id === 1 && ngay === "2026-11-24") || (b.mon_id === 4 && ngay === "2026-11-23")) continue;
    const ds = [...gdMap].filter(([id, gs]) => id !== anId && gs.some((g) => g.mon_id === b.mon_id && hieuLuc(g, ngay))).map(([id]) => id);
    await db.diem_danh.createMany({
      data: ds.map((id) => {
        const r = bam(`${b.id}:${id}`) % 13;
        return { buoi_id: b.id, hoc_sinh_id: id, trang_thai: r === 0 ? ("vang" as const) : r === 1 ? ("phep" as const) : ("co" as const), ghi_luc: new Date(b.bat_dau_luc.getTime() + 20 * 60_000), nguon: "web" as const };
      }),
    });
    await db.buoi_hoc.update({ where: { id: b.id }, data: { da_diem_danh_luc: new Date(b.bat_dau_luc.getTime() + 30 * 60_000), link_record: b.mon_id === 4 ? null : "https://drive.google.com/gia" } });
  }
  // Em HS0021 vắng 2 buổi Sử tháng 11 → "Em vắng nhiều".
  const hs21 = (await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0021" } })).id;
  const su = await db.buoi_hoc.findMany({ where: { mon_id: 2, ngay: { lt: s2d(HOM_NAY_GIA) } }, orderBy: { ngay: "asc" } });
  await db.diem_danh.updateMany({ where: { hoc_sinh_id: hs21, buoi_id: { in: su.map((b) => b.id) } }, data: { trang_thai: "vang" } });

  return { hoc_sinh: 70, ghi_danh: gd.length, buoi: await db.buoi_hoc.count(), diem_danh: await db.diem_danh.count() };
}

// Chạy trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.BCA_DATABASE_URL ?? "";
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  if (!["localhost", "127.0.0.1"].includes(host) && process.env.BCA_CHO_PHEP_XOA !== "1") {
    console.error("Từ chối: seed-gia xoá sạch DB. Chỉ chạy trên DB cục bộ, hoặc đặt BCA_CHO_PHEP_XOA=1 cho DB thử.");
    process.exit(1);
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../generated/prisma/client");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  console.log(await seedGia(db));
  await db.$disconnect();
}
