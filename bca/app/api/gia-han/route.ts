import { docJson, ngayHopLe, route, soNguyen } from "@/server/api";
import { giaHanThu } from "@/server/ghi-danh";
import { canChu } from "@/lib/quyen";

/** { maHs: ["HS0012", …], soNgay?: 7, denNgay?: "YYYY-MM-DD", lyDo: "…" } — chỉ chủ. */
export const POST = route(async (u, req) => {
  canChu(u); // quyền trước, rồi mới đọc tham số
  const b = await docJson(req);
  const maHs = Array.isArray(b.maHs) ? b.maHs.map(String) : [];
  return giaHanThu(u, maHs, { soNgay: b.soNgay === undefined ? undefined : soNguyen(b.soNgay, "soNgay"), denNgay: b.denNgay ? ngayHopLe(b.denNgay, "denNgay") : undefined }, String(b.lyDo ?? ""));
});
