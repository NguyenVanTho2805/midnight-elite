import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacTatCa } from "@/server/diem-danh";

/** { ids: number[], luc: string } — đúng giá trị trả về từ /tat-ca. */
export const POST = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return hoanTacTatCa(u, soNguyen(p.buoiId, "buoiId"), Array.isArray(b.ids) ? b.ids.map(Number) : [], String(b.luc ?? ""));
});
