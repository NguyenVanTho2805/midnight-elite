// Biểu tượng nét 24px tự vẽ (không thêm gói). Trang trí → aria-hidden; nút chỉ có biểu tượng phải có aria-label.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 24, children, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      {children}
    </svg>
  );
}
export const IconNha = (p: P) => <Svg {...p}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Svg>;
export const IconDiemDanh = (p: P) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>;
export const IconHocSinh = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Svg>;
export const IconLich = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>;
export const IconThem = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></Svg>;
export const IconDon = (p: P) => <Svg {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h5" /></Svg>;
export const IconQuayLai = (p: P) => <Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>;
export const IconTiep = (p: P) => <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>;
export const IconTim = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const IconDong = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconMoNgoai = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></Svg>;
export const IconDau = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const IconCong = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconLoc = (p: P) => <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>;
export const IconTaiKhoan = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const IconDangXuat = (p: P) => <Svg {...p}><path d="M10 4H5v16h5" /><path d="m15 8 4 4-4 4M19 12H9" /></Svg>;
export const IconTrang = (p: P) => <Svg {...p}><path d="M12 3a8.5 8.5 0 1 0 9 9 6.5 6.5 0 0 1-9-9z" /></Svg>;
