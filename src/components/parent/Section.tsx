// Mục của trang phụ huynh theo Figma 299:115140: tiêu đề nhỏ + một đường kẻ mảnh, không bọc khung quanh cả mục.
import type { ReactNode } from "react";

export default function ParentSection({ id, title, children, className = "" }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="text-base font-semibold pb-2 mb-3" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-nhat)" }}>{title}</h2>
      {children}
    </section>
  );
}
