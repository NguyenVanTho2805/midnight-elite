import { docJson, route } from "@/server/api";
import { chiTietHocSinh, suaGhiChuHocSinh } from "@/server/hoc-sinh";

export const GET = route<{ maHs: string }>((u, _req, p) => chiTietHocSinh(u, p.maHs));

/** { ghiChu?: string | null, ghiChuRieng?: string | null } — chỉ chủ. */
export const PATCH = route<{ maHs: string }>(async (u, req, p) => {
  const b = await docJson(req);
  const s = (v: unknown) => (v === undefined ? undefined : v === null ? null : String(v));
  return suaGhiChuHocSinh(u, p.maHs, { ghiChu: s(b.ghiChu), ghiChuRieng: s(b.ghiChuRieng) });
});
