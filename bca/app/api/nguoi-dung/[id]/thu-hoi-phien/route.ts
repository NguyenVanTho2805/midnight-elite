import { docJson, route } from "@/server/api";
import { thuHoiPhien } from "@/server/nguoi-dung";

/** { khoaTaiKhoan?: boolean } — chỉ chủ. */
export const POST = route<{ id: string }>(async (u, req, p) => {
  const b = await docJson(req).catch(() => ({}) as Record<string, unknown>);
  return thuHoiPhien(u, p.id, b.khoaTaiKhoan === true);
});
