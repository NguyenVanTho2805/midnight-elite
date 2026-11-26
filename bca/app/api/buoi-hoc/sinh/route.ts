import { canChu, LoiDuLieu } from "@/lib/quyen";
import { docJson, route } from "@/server/api";
import { sinhBuoiThang, xemTruocSinhBuoi } from "@/server/buoi-hoc";

/** { thang: "2027-01" } — chỉ chủ. Sinh buổi theo lịch, lặp lại an toàn. */
export const POST = route(async (u, req) => sinhBuoiThang(u, String((await docJson(req)).thang ?? "")));

/** ?thang=2027-01&xem=1 — chỉ chủ. Xem trước số buổi sẽ tạo theo môn, không ghi gì. */
export const GET = route((u, req) => {
  const q = new URL(req.url).searchParams;
  canChu(u); // quyền trước: GV/học sinh luôn 403, không 400
  if (q.get("xem") !== "1") throw new LoiDuLieu("Thiếu xem=1 (GET chỉ để xem trước; sinh buổi dùng POST)");
  return xemTruocSinhBuoi(u, q.get("thang") ?? "");
});
