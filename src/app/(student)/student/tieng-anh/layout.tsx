// Khu "Tiếng Anh tự học" (docs/tieng-anh/DAC-TA.md): thanh mục con + nội dung. Nằm trong vỏ học sinh nên đã có AuthGuard.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/student/tieng-anh", label: "Hôm nay", exact: true },
  { href: "/student/tieng-anh/tu-vung", label: "Từ vựng" },
  { href: "/student/tieng-anh/doc", label: "Đọc" },
  { href: "/student/tieng-anh/nghe", label: "Nghe" },
  { href: "/student/tieng-anh/lop-hoc", label: "Lớp học" },
  { href: "/student/tieng-anh/hoi-sach", label: "Hỏi sách" },
  { href: "/student/tieng-anh/viet", label: "Viết" },
  { href: "/student/tieng-anh/thi-thu", label: "Thi thử IELTS" },
  { href: "/student/tieng-anh/tien-do", label: "Tiến độ" },
];

export default function EnglishLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/"));
  return (
    <div className="max-w-5xl mx-auto">
      <nav aria-label="Tiếng Anh" className="mb-5 -mx-1 overflow-x-auto">
        <ul className="flex gap-1 min-w-max border-b" style={{ borderColor: "var(--kin-vien-thuong)" }}>
          {TABS.map(t => (
            <li key={t.href}>
              <Link href={t.href} aria-current={active(t) ? "page" : undefined}
                className="inline-flex items-center min-h-11 px-3 text-sm font-medium border-b-2 -mb-px"
                style={active(t)
                  ? { borderColor: "var(--kin-nhan-nen)", color: "var(--kin-chu-chinh)" }
                  : { borderColor: "transparent", color: "var(--kin-chu-phu)" }}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
