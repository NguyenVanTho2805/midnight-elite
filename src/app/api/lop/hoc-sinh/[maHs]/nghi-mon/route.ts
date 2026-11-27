import { canChu } from "@/lib/lop/quyen";
import { docJson, ngayHopLe, route } from "@/lib/lop/server/api";
import { nghiMon } from "@/lib/lop/server/ghi-danh";

/** { mon: "anh" | ["toan","anh"], denNgay?: "YYYY-MM-DD" } — chỉ chủ; mặc định luật 22:00; ghi nghi_luc (T34). */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  return nghiMon(u, p.maHs, Array.isArray(b.mon) ? b.mon.map(String) : String(b.mon ?? ""), b.denNgay ? ngayHopLe(b.denNgay, "denNgay") : undefined);
});
