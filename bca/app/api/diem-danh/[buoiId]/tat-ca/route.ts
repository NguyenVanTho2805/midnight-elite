import { docJson, route, soNguyen } from "@/server/api";
import { danhTatCaCoMat } from "@/server/diem-danh";

export const POST = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req).catch(() => ({}) as Record<string, unknown>);
  return danhTatCaCoMat(u, soNguyen(p.buoiId, "buoiId"), { xacNhan: b.xacNhan === true });
});
