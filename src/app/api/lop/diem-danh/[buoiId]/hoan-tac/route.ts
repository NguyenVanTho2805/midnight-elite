import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { hoanTacTatCa } from "@/lib/lop/server/diem-danh";

/** { luc: string } — đúng giá trị `luc` trả về từ /tat-ca (máy chủ lấy danh sách em từ nhật ký của chính người đó). */
export const POST = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return hoanTacTatCa(u, soNguyen(p.buoiId, "buoiId"), String(b.luc ?? ""));
});
