import { docJson, ngayHopLe, route } from "@/server/api";
import { anHocSinh } from "@/server/ghi-danh";

/** { denNgay?: "YYYY-MM-DD" } — chỉ chủ. Ẩn hồ sơ, dừng mọi ghi danh còn mở theo luật 22:00 (T7: không xoá cứng). */
export const POST = route<{ maHs: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return anHocSinh(u, p.maHs, b.denNgay ? ngayHopLe(b.denNgay, "denNgay") : undefined);
});
