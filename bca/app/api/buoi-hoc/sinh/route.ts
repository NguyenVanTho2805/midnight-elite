import { docJson, route } from "@/server/api";
import { sinhBuoiThang, xemTruocSinhBuoi } from "@/server/buoi-hoc";

/** { thang: "2027-01" } — chỉ chủ. Sinh buổi theo lịch, lặp lại an toàn. */
export const POST = route(async (u, req) => sinhBuoiThang(u, String((await docJson(req)).thang ?? "")));

/** ?thang=2027-01&xem=1 — chỉ chủ. Xem trước số buổi sẽ tạo theo môn, không ghi gì. */
export const GET = route((u, req) => xemTruocSinhBuoi(u, new URL(req.url).searchParams.get("thang") ?? ""));
