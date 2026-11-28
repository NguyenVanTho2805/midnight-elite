import { canChu } from "@/lib/lop/quyen";
import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacXuLyDon } from "@/lib/lop/server/don";

/** { nhatKyId } — chỉ chủ. Hoàn tác "Tạo hồ sơ từ đơn" hoặc "Bỏ qua" trong hạn (T43, T45). */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return hoanTacXuLyDon(u, soNguyen(p.id, "id"), soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
