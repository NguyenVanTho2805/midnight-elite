// Đăng nhập thử theo vai (Đợt 2 thay bằng Google). T40: chỉ máy cục bộ, hoặc địa chỉ xem thử Vercel với DB dữ liệu giả.
import { ngayVN } from "@/lib/ngay";
import { conMo, hetThu, hieuLuc } from "@/lib/quy-tac";
import { db } from "./db";
import { napGD } from "./du-lieu";
import { devLoginBat, mayCucBo, type Phien } from "./token";

/** Khoá cai_dat do seed-gia.ts ghi. chuyen-tu-sheet.ts không bao giờ ghi khoá này (và xoá nó khi --apply). */
export const DAU_DU_LIEU_GIA = "DU_LIEU_GIA";

/** T40: (a) cục bộ + BCA_DEV_LOGIN=1; (b) VERCEL_ENV=preview + BCA_DEV_LOGIN=1 + DB có dấu DU_LIEU_GIA. Production: không bao giờ. */
export async function dangNhapThuBat() {
  if (!devLoginBat()) return false;
  return mayCucBo() || !!(await db.cai_dat.findUnique({ where: { khoa: DAU_DU_LIEU_GIA }, select: { khoa: true } }));
}

export const VAI_THU = {
  chu: "Chủ lớp",
  gv_toan: "Giáo viên Toán",
  gv_anh: "Giáo viên Anh",
  hs_chinh_thuc: "Học sinh chính thức",
  hs_thu: "Học sinh thử còn hạn",
  hs_het_han: "Học sinh hết hạn thử",
} as const;
export type VaiThu = keyof typeof VAI_THU;

async function nguoiDungThu(gmail: string, ten: string, vai: "chu" | "giao_vien", monMa?: string) {
  const nd = await db.nguoi_dung.upsert({ where: { gmail }, create: { gmail, ten_hien_thi: ten, vai_tro: vai }, update: {} });
  if (monMa) {
    const m = await db.mon.findUniqueOrThrow({ where: { ma: monMa } });
    await db.phan_cong.upsert({ where: { nguoi_dung_id_mon_id: { nguoi_dung_id: nd.id, mon_id: m.id } }, create: { nguoi_dung_id: nd.id, mon_id: m.id }, update: {} });
  }
  return nd.id;
}

export async function phienThu(vai: VaiThu, luc = new Date()): Promise<Phien | null> {
  if (!(await dangNhapThuBat())) return null;
  const bd = Math.floor(luc.getTime() / 1000);
  if (vai === "chu") return { sub: await nguoiDungThu("chu.thu@bca.invalid", "Chủ lớp (thử)", "chu"), vai: "nd", bd };
  if (vai === "gv_toan") return { sub: await nguoiDungThu("gv.toan@bca.invalid", "GV Toán (thử)", "giao_vien", "toan"), vai: "nd", bd };
  if (vai === "gv_anh") return { sub: await nguoiDungThu("gv.anh@bca.invalid", "GV Anh (thử)", "giao_vien", "anh"), vai: "nd", bd };
  const h = ngayVN(luc);
  const hs = await db.hoc_sinh.findMany({ where: { an_luc: null }, select: { id: true }, orderBy: { ma_hs: "asc" } });
  const gdMap = await napGD();
  const hop = hs.find(({ id }) => {
    const gds = gdMap.get(id) ?? [];
    if (vai === "hs_chinh_thuc") return gds.some((g) => g.loai === "chinh_thuc" && hieuLuc(g, h));
    if (vai === "hs_thu") return gds.some((g) => g.loai === "thu" && hieuLuc(g, h)) && !gds.some((g) => g.loai === "chinh_thuc" && conMo(g, h));
    return !!hetThu(gds, h);
  });
  return hop ? { sub: String(hop.id), vai: "hs", bd } : null;
}
