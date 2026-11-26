import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacXuLyDon } from "@/server/don";

/** { nhatKyId } — chỉ chủ. Hoàn tác "Tạo hồ sơ từ đơn" hoặc "Bỏ qua" trong 10 giây (T43). */
export const POST = route<{ id: string }>(async (u, req, p) => hoanTacXuLyDon(u, soNguyen(p.id, "id"), soNguyen((await docJson(req)).nhatKyId, "nhatKyId")));
