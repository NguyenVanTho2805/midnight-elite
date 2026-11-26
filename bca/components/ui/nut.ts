// Lớp nút dùng chung (token.md: vùng bấm ≥ 44px, bo 14 cho nút, 10 cho nút nhỏ). Không nền cam/xanh chữ trắng.
const goc = "nhan inline-flex items-center justify-center gap-2 rounded-[14px] px-4 font-semibold text-center disabled:opacity-60 disabled:cursor-not-allowed";
/** Nút chính vàng, cao 48. */
export const nutChinh = `${goc} min-h-12 bg-gold text-on-gold hover:bg-gold-hover`;
/** Nút chính vàng cao 56 (thẻ tối nay, Đánh tất cả có mặt). */
export const nutChinhTo = `${goc} min-h-14 bg-gold text-on-gold hover:bg-gold-hover text-[17px]`;
/** Nút phụ viền border-input, cao 44. */
export const nutPhu = `${goc} min-h-11 border border-border-input text-text hover:bg-row-hover`;
/** Nút việc nguy hiểm: viền + chữ danger, không nền đỏ. */
export const nutNguy = `${goc} min-h-12 border border-danger text-danger hover:bg-danger-bg`;
/** Nút chỉ chữ/biểu tượng 44×44. */
export const nutBieuTuong = "nhan inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] text-text-2 hover:bg-row-hover hover:text-text";
/** Ô nhập: viền border-input (≥ 3:1), chữ 16 trên điện thoại, 14 trên máy tính. */
export const oNhap = "min-h-12 w-full rounded-[14px] border border-border-input bg-bg px-3 text-base text-text placeholder:text-text-3 lg:text-sm";
export const nhan = "block text-[13px] font-semibold text-text-2";
