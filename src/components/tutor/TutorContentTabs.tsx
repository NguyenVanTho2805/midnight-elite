// BU-00 bước 3 — dải tab trang con của vỏ NỘI DUNG gia sư (/lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop/[id]*), thay AdminTabStrip của vỏ quản trị.
// Là ĐIỀU HƯỚNG giữa các trang (Link + aria-current), không phải tab đổi nội dung → dùng KIN_TAB_BOX + KinTabInner như AdminShell, không role=tab.
// Đọc ?tab= (trang quản lớp) nên cần useSearchParams → nơi dùng bọc <Suspense> (layout của nhóm (noi-dung)).
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import { contentTabsFor } from "@/lib/tutorRoutes";

export default function TutorContentTabs() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const group = contentTabsFor(pathname, tab);
  if (!group) return null;
  return (
    <nav aria-label={`Trang của ${group.label}`} className="flex items-stretch gap-1 px-3 border-b border-[var(--kin-vien-thuong)] overflow-x-auto flex-shrink-0 bg-[var(--kin-nen-trang)] print:hidden">
      {group.tabs.map(t => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={KIN_TAB_BOX}>
          <KinTabInner active={t.active}>{t.label}</KinTabInner>
        </Link>
      ))}
    </nav>
  );
}
