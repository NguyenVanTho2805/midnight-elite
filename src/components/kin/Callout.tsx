// Khối nhắc nền nhạt (Figma "Chờ phụ huynh", "Chỉ chốt buổi đã dạy…"): nền --kin-nen-bang, vạch trái mảnh, không bóng.
// tone "nhan" = nền xanh nhạt (khối "Buổi học hôm nay" trên điện thoại). Nội dung luôn có chữ; màu không nói một mình.
import type { ReactNode } from "react";

export function KinCallout({ title, children, tone = "nhat", className = "" }: {
  title?: ReactNode;
  children?: ReactNode;
  tone?: "nhat" | "nhan";
  className?: string;
}) {
  const bg = tone === "nhan" ? "bg-[var(--kin-nen-nhan)]" : "bg-[var(--kin-nen-bang)]";
  const edge = tone === "nhan" ? "" : "border-l-2 border-[var(--kin-vien-thuong)]";
  return (
    <div data-kin-callout={tone} className={`${bg} ${edge} px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] ${className}`}>
      {title && <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">{title}</p>}
      {children && <div className={`${title ? "mt-1.5 " : ""}text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]`}>{children}</div>}
    </div>
  );
}
