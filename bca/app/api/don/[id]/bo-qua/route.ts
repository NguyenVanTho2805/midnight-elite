import { docJson, route, soNguyen } from "@/server/api";
import { boQuaDon } from "@/server/don";

/** { lyDo } — chỉ chủ (T43). Trả nhatKyId để Hoàn tác. */
export const POST = route<{ id: string }>(async (u, req, p) => boQuaDon(u, soNguyen(p.id, "id"), String((await docJson(req)).lyDo ?? "")));
