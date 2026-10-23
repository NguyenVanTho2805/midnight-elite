// Số liệu một ô (Figma "Hộp việc" 299:111821, dải 4 số): nhãn nhỏ phía trên, số, dòng phụ.
// Số KHÔNG lớn quá 22px (quy tắc cứng); không khung, không nền — ngăn cách bằng khoảng trắng.
import type { ReactNode } from "react";

export function KinStat({ label, value, hint, className = "" }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div data-kin-stat className={`min-w-0 ${className}`}>
      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{label}</p>
      <p className="mt-[var(--kin-kc-3)] text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)] break-words">{value}</p>
      {hint && <p className="mt-[var(--kin-kc-3)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</p>}
    </div>
  );
}

/** Hàng số liệu: 4 ô ngang trên máy tính, 2 cột trên điện thoại, kẻ mảnh phía trên và dưới. */
export function KinStatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div data-kin-stat-row className={`grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 py-6 border-y border-[var(--kin-vien-nhat)] ${className}`}>
      {children}
    </div>
  );
}
