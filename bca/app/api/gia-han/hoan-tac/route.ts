import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacGiaHan } from "@/server/ghi-danh";

export const POST = route(async (u, req) => hoanTacGiaHan(u, soNguyen((await docJson(req)).nhatKyId, "nhatKyId")));
