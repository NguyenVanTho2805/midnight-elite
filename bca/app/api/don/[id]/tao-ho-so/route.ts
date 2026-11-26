import { canChu } from "@/lib/quyen";
import { docJson, ngayHopLe, route, soNguyen } from "@/server/api";
import { taoHoSoTuDon, xemTruocDon } from "@/server/don";
import type { HoSoMoi } from "@/server/hoc-sinh";

/** Chỉ chủ. Xem trước: hồ sơ điền sẵn từ đơn, môn, khoảng thử dự kiến, `muon_chinh_thuc`, hồ sơ có thể trùng (`trung`). */
export const GET = route<{ id: string }>((u, _req, p) => {
  canChu(u);
  return xemTruocDon(u, soNguyen(p.id, "id"));
});

const O_HO_SO = ["hoTen", "sdtHs", "sdtPh", "gmail", "hoTenPh", "truong", "khoi", "mucTieu", "nguon", "usernameAzota", "ghiChu", "ghiChuRieng"] as const;

/**
 * { maHs?, taoMoi?, capThuMoi?, hoSo?: {hoTen?, ngayTao?, sdtHs?, …} } — chỉ chủ (T43).
 * Trả `ket_qua`: "da_tao" | "da_gan" (kèm nhatKyId để Hoàn tác) | "trung_ho_so" (kèm goi_y, chưa ghi gì) | "can_chu_quyet" (ly_do, chưa ghi gì).
 */
export const POST = route<{ id: string }>(async (u, req, p) => {
  canChu(u);
  const b = await docJson(req);
  const h = (b.hoSo && typeof b.hoSo === "object" ? b.hoSo : {}) as Record<string, unknown>;
  const hoSo: Partial<HoSoMoi> = {};
  for (const k of O_HO_SO) if (h[k] !== undefined && h[k] !== null) hoSo[k] = String(h[k]);
  if (h.ngayTao) hoSo.ngayTao = ngayHopLe(h.ngayTao, "ngayTao");
  if (typeof h.dongYVinhDanh === "boolean") hoSo.dongYVinhDanh = h.dongYVinhDanh;
  return taoHoSoTuDon(u, soNguyen(p.id, "id"), { maHs: b.maHs ? String(b.maHs) : undefined, taoMoi: b.taoMoi === true, capThuMoi: b.capThuMoi === true, hoSo });
});
