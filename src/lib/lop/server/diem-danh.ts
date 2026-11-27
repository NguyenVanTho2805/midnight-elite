// Tiến độ điểm danh của buổi (chép phần ĐỌC từ bca/server/diem-danh.ts). Phần ghi để bước 5.
import { prisma } from "@/lib/prisma";
import { d2s } from "../ngay";
import { demDD, loaiVaoNgay, type GD } from "../quy-tac";
import { napGD } from "./du-lieu";

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
export async function tienDo(buois: BuoiMin[]) {
  const monIds = [...new Set(buois.map((b) => b.mon_id))];
  const [gdMap, an, dd] = await Promise.all([
    napGD({ mon_id: { in: monIds } }),
    prisma.bcaHocSinh.findMany({ where: { an_luc: { not: null } }, select: { id: true } }),
    prisma.bcaDiemDanh.findMany({ where: { buoi_id: { in: buois.map((b) => b.id) } }, select: { buoi_id: true, hoc_sinh_id: true, trang_thai: true } }),
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
