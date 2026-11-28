import { canChu } from "@/lib/lop/quyen";
import { docJson, route } from "@/lib/lop/server/api";
import { suaGhiChuHocSinh, suaHoSoHocSinh, type SuaHoSo } from "@/lib/lop/server/hoc-sinh";

const O_HO_SO = ["hoTen", "sdtHs", "sdtPh", "gmail", "hoTenPh", "truong", "khoi", "mucTieu", "usernameAzota"] as const;
/** Chỉ chủ. { ghiChu?, ghiChuRieng? } ⇒ sửa ghi chú; { hoSo: { hoTen?, sdtHs?, sdtPh?, gmail?, hoTenPh?, truong?, khoi?, mucTieu?, usernameAzota? } } ⇒ sửa thông tin hồ sơ. */
export const PATCH = route<{ maHs: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  const s = (v: unknown) => (v === undefined ? undefined : v === null ? null : String(v));
  if (b.hoSo && typeof b.hoSo === "object") {
    const h = b.hoSo as Record<string, unknown>, v: SuaHoSo = {};
    for (const k of O_HO_SO) if (h[k] !== undefined) v[k] = s(h[k]);
    return suaHoSoHocSinh(u, p.maHs, v);
  }
  return suaGhiChuHocSinh(u, p.maHs, { ghiChu: s(b.ghiChu), ghiChuRieng: s(b.ghiChuRieng) });
});
