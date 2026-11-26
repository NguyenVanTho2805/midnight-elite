import { docJson, route, soNguyen } from "@/server/api";
import { hoanTacChuyenChinhThuc } from "@/server/ghi-danh";

/** { nhatKyId } (trả về từ chuyển chính thức) — chỉ chủ, một lần, trong 5 giây (+5 giây mạng). */
export const POST = route<{ maHs: string }>(async (u, req, p) => hoanTacChuyenChinhThuc(u, p.maHs, soNguyen((await docJson(req)).nhatKyId, "nhatKyId")));
