// Logo KiN (Figma 59:9 "Biểu tượng K"): thân K xanh navy + ba lưỡi
// (xanh dương, xanh trời, vàng hổ phách) toả ra bên phải.
//
// Vẽ lại bằng SVG nội tuyến theo ảnh xuất từ Figma, vì tải file SVG gốc từ
// figma.com bị chặn ở môi trường dựng. Màu lấy từ token --kin-th-* nên không
// viết cứng mã màu. Khi có file SVG gốc thì thay phần <svg> bên dưới.
import type { CSSProperties } from "react";

export function KinMark({ size = 32, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <rect x="2" y="2" width="7" height="36" rx="3.5" fill="var(--kin-th-navy, #1e3a8a)" />
      <path d="M10.8 20 L11.6 17.4 C17 11.5 24 6 31 2.2 C27 8.5 19 15.5 14.5 19.6 Z" fill="var(--kin-th-xanh-link, #2563eb)" />
      <path d="M10.5 21.4 C10.5 19.8 12.4 18.3 16.2 17.6 L33.4 16.2 C34.4 15.7 35.1 15.3 35.7 14.8 C34.2 17.8 30 19.8 24 20.9 L10.9 21.8 Z" fill="var(--kin-th-xanh-troi, #38bdf8)" />
      <path d="M10.3 21.9 L13.1 22.1 C17.3 27.4 22 33 25.6 38.4 C19 35.2 13 29.2 10.3 21.9 Z" fill="var(--kin-th-vang-nang, #f59e0b)" />
    </svg>
  );
}

/** Logo + chữ "KiN". Chữ theo màu nhấn của chủ đề; dùng --kin-nhan-chu-tren-nhat (= --kin-nhan-nen ở chế độ sáng, bản sáng hơn ở chế độ tối) để đọc được trên nền tối. */
export function KinLogo({ size = 32, textSize = "var(--kin-co-h4, 19.2px)", color = "var(--kin-nhan-chu-tren-nhat, #1e3a8a)" }: {
  size?: number;
  textSize?: string;
  color?: string;
}) {
  return (
    <span className="inline-flex items-center" style={{ gap: size >= 30 ? 10 : 9 }}>
      <KinMark size={size} />
      <span className="kin-chu-logo leading-none" style={{ fontSize: textSize, color }}>KiN</span>
    </span>
  );
}
