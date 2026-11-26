import { docJson, ngayHopLe, route } from "@/server/api";
import { giaHanThu } from "@/server/ghi-danh";

/** { maHs: ["HS0012", …], soNgay?: 7, denNgay?: "YYYY-MM-DD", lyDo: "…" } — chỉ chủ. */
export const POST = route(async (u, req) => {
  const b = await docJson(req);
  const maHs = Array.isArray(b.maHs) ? b.maHs.map(String) : [];
  return giaHanThu(u, maHs, { soNgay: b.soNgay === undefined ? undefined : Number(b.soNgay), denNgay: b.denNgay ? ngayHopLe(b.denNgay, "denNgay") : undefined }, String(b.lyDo ?? ""));
});
