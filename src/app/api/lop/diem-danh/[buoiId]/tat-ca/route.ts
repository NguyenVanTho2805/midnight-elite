import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { danhTatCaCoMat } from "@/lib/lop/server/diem-danh";

export const POST = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req).catch(() => ({}) as Record<string, unknown>);
  return danhTatCaCoMat(u, soNguyen(p.buoiId, "buoiId"), { xacNhan: b.xacNhan === true });
});
