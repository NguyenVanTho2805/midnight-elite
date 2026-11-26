import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacTatCa } from "@/server/diem-danh";

/** { luc: string } — đúng giá trị `luc` trả về từ /tat-ca (trường `ids` cũ được bỏ qua: máy chủ lấy danh sách em từ nhật ký). */
export const POST = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return hoanTacTatCa(u, soNguyen(p.buoiId, "buoiId"), String(b.luc ?? ""));
});
