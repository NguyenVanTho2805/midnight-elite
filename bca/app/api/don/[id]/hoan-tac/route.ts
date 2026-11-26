import { canChu } from "@/lib/quyen";
import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacXuLyDon } from "@/server/don";

/** { nhatKyId } — chỉ chủ. Hoàn tác "Tạo hồ sơ từ đơn" hoặc "Bỏ qua" trong 10 giây (T43, T45). Quyền trước tham số: GV/học sinh luôn 403. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  return hoanTacXuLyDon(u, soNguyen(p.id, "id"), soNguyen((await docJson(req)).nhatKyId, "nhatKyId"));
});
