import { docJson, ngayHopLe, route } from "@/server/api";
import { nghiMon } from "@/server/ghi-danh";

/** { mon: "anh", denNgay?: "YYYY-MM-DD" } — chỉ chủ; mặc định luật 22:00. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return nghiMon(u, p.maHs, String(b.mon ?? ""), b.denNgay ? ngayHopLe(b.denNgay, "denNgay") : undefined);
});
