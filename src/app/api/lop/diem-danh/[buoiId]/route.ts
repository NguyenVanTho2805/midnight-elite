import { docJson, route, soNguyen } from "@/lib/lop/server/api";
import { chiTietDiemDanh, datDiemDanh } from "@/lib/lop/server/diem-danh";
import type { TrangThaiDD } from "@/lib/lop/quy-tac";

export const GET = route<{ buoiId: string }>((u, _req, p) => chiTietDiemDanh(u, soNguyen(p.buoiId, "buoiId")));

/** { hocSinhId, trangThai?: "co"|"phep"|"vang"|null, ghiChu?: string|null, xacNhan?: boolean } — chủ + GV môn (kiểm trong datDiemDanh, trước khi khoá dòng). */
export const PUT = route<{ buoiId: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return datDiemDanh(u, soNguyen(p.buoiId, "buoiId"), soNguyen(b.hocSinhId, "hocSinhId"), {
    trangThai: b.trangThai === undefined ? undefined : (b.trangThai as TrangThaiDD | null),
    ghiChu: b.ghiChu === undefined ? undefined : b.ghiChu === null ? null : String(b.ghiChu),
    xacNhan: b.xacNhan === true,
  });
});
