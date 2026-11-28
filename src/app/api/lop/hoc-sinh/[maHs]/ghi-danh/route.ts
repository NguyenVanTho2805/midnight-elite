import { canChu } from "@/lib/lop/quyen";
import { docJson, ngayHopLe, route } from "@/lib/lop/server/api";
import { themMon } from "@/lib/lop/server/ghi-danh";

/** { mon: "toan", loai: "thu" | "chinh_thuc", tuNgay?: "YYYY-MM-DD" } — chỉ chủ. Thêm môn, hoặc cho em đã nghỉ học lại. */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  const loai = b.loai === "chinh_thuc" ? "chinh_thuc" : "thu";
  return themMon(u, p.maHs, String(b.mon ?? ""), loai, b.tuNgay ? ngayHopLe(b.tuNgay, "tuNgay") : undefined);
});
