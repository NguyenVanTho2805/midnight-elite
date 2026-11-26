import { docJson, ngayHopLe, route } from "@/server/api";
import { themMon } from "@/server/ghi-danh";

/** { mon: "toan", loai: "thu" | "chinh_thuc", tuNgay?: "YYYY-MM-DD" } — chỉ chủ. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  const b = await docJson(req);
  const loai = b.loai === "chinh_thuc" ? "chinh_thuc" : "thu";
  return themMon(u, p.maHs, String(b.mon ?? ""), loai, b.tuNgay ? ngayHopLe(b.tuNgay, "tuNgay") : undefined);
});
