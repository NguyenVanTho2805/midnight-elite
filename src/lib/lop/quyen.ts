// Phân quyền thuần (phan-quyen.md). Máy chủ gọi các hàm này ở MỌI route.
export type NguoiQuanLy = { vai: "chu" | "giao_vien"; id: string; ten: string; monIds: number[] };
export type NguoiHocSinh = { vai: "hoc_sinh"; hocSinhId: number; ten: string };
export type Nguoi = NguoiQuanLy | NguoiHocSinh;

export class LoiQuyen extends Error {
  status = 403;
}
export class LoiDuLieu extends Error {
  constructor(msg: string, public status = 400, public ma?: string) {
    super(msg);
  }
}

export const laChu = (u: Nguoi) => u.vai === "chu";
export const laQuanLy = (u: Nguoi): u is NguoiQuanLy => u.vai !== "hoc_sinh";
/** Chủ: mọi môn. GV: môn trong phan_cong. Học sinh: không môn nào (đường riêng /api/hs). */
export const coMon = (u: Nguoi, monId: number) => laChu(u) || (u.vai === "giao_vien" && u.monIds.includes(monId));
/** null = mọi môn. */
export const monXemDuoc = (u: NguoiQuanLy): number[] | null => (u.vai === "chu" ? null : u.monIds);

export function canChu(u: Nguoi): asserts u is NguoiQuanLy {
  if (!laChu(u)) throw new LoiQuyen("Chỉ chủ lớp được làm việc này");
}
export function canQuanLy(u: Nguoi): asserts u is NguoiQuanLy {
  if (!laQuanLy(u)) throw new LoiQuyen("Khu quản lý chỉ dành cho chủ lớp và giáo viên");
}
export function canMon(u: Nguoi, monId: number) {
  if (!coMon(u, monId)) throw new LoiQuyen("Bạn không dạy môn này");
}

/**
 * Cột hồ sơ được CHỌN theo vai (phan-quyen.md 4.2 — không lấy hết rồi giấu).
 * GV: không SĐT/Gmail HS (T14), không thông tin PH, không tiền, không ghi chú riêng.
 */
export const COT_HS_GV = { id: true, ma_hs: true, ho_ten: true, username_azota: true, an_luc: true, lua: { select: { ma: true, ten: true } } } as const;
export const COT_HS_CHU = {
  ...COT_HS_GV,
  sdt_hs: true, sdt_ph: true, gmail: true, ho_ten_ph: true, truong: true, khoi: true, muc_tieu: true, nguon: true,
  dong_y_vinh_danh: true, da_nhan_chao: true, ghi_chu: true, ghi_chu_rieng: true, ngay_tao: true, so_du_dau_ky: true, lua_id: true,
} as const;
export const cotHocSinh = (u: NguoiQuanLy) => (laChu(u) ? COT_HS_CHU : COT_HS_GV);
