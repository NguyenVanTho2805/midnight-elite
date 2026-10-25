// Đầu mục (Figma "Cần cô xử lý … 3 việc"): tiêu đề 18px bên trái, phụ đề hoặc tiện ích bên phải, kẻ mảnh --kin-vien-nhat bên dưới.
// `as` chọn cấp thẻ tiêu đề (mặc định h2) để trang giữ đúng thứ bậc heading.
import type { ReactNode } from "react";

export function KinSectionHead({ title, aside, as: Tag = "h2", className = "", id }: {
  title: ReactNode;
  /** Phụ đề ("3 việc") hoặc tiện ích bên phải (liên kết, nút chữ). */
  aside?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    <div data-kin-section-head className={`flex items-baseline justify-between gap-3 pb-[var(--kin-kc-5)] border-b border-[var(--kin-vien-nhat)] ${className}`}>
      <Tag id={id} className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{title}</Tag>
      {aside != null && <div className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] flex-shrink-0">{aside}</div>}
    </div>
  );
}
