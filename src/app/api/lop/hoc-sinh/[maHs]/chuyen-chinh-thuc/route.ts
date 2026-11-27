import { canChu } from "@/lib/lop/quyen";
import { docJson, ngayHopLe, route } from "@/lib/lop/server/api";
import { chuyenChinhThuc } from "@/lib/lop/server/ghi-danh";

/** { mon: ["toan","anh"], tuNgay?: "YYYY-MM-DD", nghiMonThuConLai?: boolean } — chỉ chủ. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  const mon = Array.isArray(b.mon) ? b.mon.map(String) : [];
  return chuyenChinhThuc(u, p.maHs, mon, { tuNgay: b.tuNgay ? ngayHopLe(b.tuNgay, "tuNgay") : undefined, nghiMonThuConLai: b.nghiMonThuConLai === true });
});
