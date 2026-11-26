import { docJson, route, soNguyen } from "@/server/api";
import { suaNoiDungBuoi, xoaBuoi } from "@/server/buoi-hoc";

/** { noiDung?, linkRecord?, ghiChu? } — chủ + GV môn. ghiChu = ghi chú nội bộ buổi (học sinh không thấy). */
export const PATCH = route<{ id: string }>(async (u, req, p) => {
  const b = await docJson(req);
  const s = (v: unknown) => (v === undefined ? undefined : v === null ? null : String(v));
  return suaNoiDungBuoi(u, soNguyen(p.id, "id"), { noiDung: s(b.noiDung), linkRecord: s(b.linkRecord), ghiChu: s(b.ghiChu) });
});

/** Chỉ chủ (T42). Xoá buổi chưa bắt đầu, chưa có dữ liệu; trả nhatKyId để hoàn tác. Có dữ liệu → 409 co_du_lieu; đã qua → 409 da_qua (chỉ huỷ được). */
export const DELETE = route<{ id: string }>((u, _req, p) => xoaBuoi(u, soNguyen(p.id, "id")));
