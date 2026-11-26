import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacXoaBuoi } from "@/server/buoi-hoc";

/** { nhatKyId } (từ DELETE /api/buoi-hoc/[id]) — chỉ chủ, trong 10 giây (T42). */
export const POST = route<{ id: string }>(async (u, req, p) => hoanTacXoaBuoi(u, soNguyen(p.id, "id"), soNguyen((await docJson(req)).nhatKyId, "nhatKyId")));
