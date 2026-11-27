import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { sinhBuoiConThieu, xemTruocBuoiConThieu } from "@/lib/lop/server/buoi-hoc";

/** ?thang=YYYY-MM — chỉ chủ. Xem trước "Sinh buổi còn thiếu", không ghi gì (T42). */
export const GET = route(async (u, req) => {
  canChu(u); // quyền trước: GV luôn 403, không 400
  return xemTruocBuoiConThieu(u, new URL(req.url).searchParams.get("thang") ?? "");
});

/** { thang: "YYYY-MM" } — chỉ chủ. Chỉ thêm buổi theo lịch còn thiếu và chưa bắt đầu; không đụng buổi có sẵn. */
export const POST = route(async (u, req) => {
  canChu(u);
  return sinhBuoiConThieu(u, String((await docJson(req)).thang ?? ""));
});
