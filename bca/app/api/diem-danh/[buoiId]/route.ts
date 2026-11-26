import { docJson, route, soNguyen } from "@/server/api";
import { chiTietDiemDanh, datDiemDanh } from "@/server/diem-danh";
import type { TrangThaiDD } from "@/lib/quy-tac";

export const GET = route<{ buoiId: string }>((u, _req, p) => chiTietDiemDanh(u, soNguyen(p.buoiId, "buoiId")));

/** { hocSinhId, trangThai?: "co"|"phep"|"vang"|null, ghiChu?: string|null, xacNhan?: boolean } */
export const PUT = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return datDiemDanh(u, soNguyen(p.buoiId, "buoiId"), soNguyen(b.hocSinhId, "hocSinhId"), {
    trangThai: b.trangThai === undefined ? undefined : (b.trangThai as TrangThaiDD | null),
    ghiChu: b.ghiChu === undefined ? undefined : b.ghiChu === null ? null : String(b.ghiChu),
    xacNhan: b.xacNhan === true,
  });
});
