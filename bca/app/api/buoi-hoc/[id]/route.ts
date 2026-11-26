import { docJson, route, soNguyen } from "@/server/api";
import { suaNoiDungBuoi, xoaBuoi } from "@/server/buoi-hoc";

/** { noiDung?, linkRecord? } — chủ + GV môn. */
export const PATCH = route<{ id: string }>(async (u, req, p) => {
  const b = await docJson(req);
  const s = (v: unknown) => (v === undefined ? undefined : v === null ? null : String(v));
  return suaNoiDungBuoi(u, soNguyen(p.id, "id"), { noiDung: s(b.noiDung), linkRecord: s(b.linkRecord) });
});

/** Chỉ chủ. Xoá buổi chưa có dữ liệu; có điểm danh/nội dung/record/ghi chú/đã huỷ/có buổi bù → 409 (chỉ huỷ được). */
export const DELETE = route<{ id: string }>((u, _req, p) => xoaBuoi(u, soNguyen(p.id, "id")));
