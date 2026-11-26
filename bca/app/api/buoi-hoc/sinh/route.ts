import { docJson, route } from "@/server/api";
import { sinhBuoiThang } from "@/server/buoi-hoc";

export const POST = route(async (u, req) => sinhBuoiThang(u, String((await docJson(req)).thang ?? "")));
