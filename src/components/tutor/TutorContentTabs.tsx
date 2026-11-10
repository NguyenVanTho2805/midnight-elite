// BU-00 bước 3 — dải tab trang con của vỏ NỘI DUNG gia sư (/lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop/[id]*), thay AdminTabStrip của vỏ quản trị.
// Là ĐIỀU HƯỚNG giữa các trang (Link + aria-current), không phải tab đổi nội dung → dùng KIN_TAB_BOX + KinTabInner như AdminShell, không role=tab.
// GS-LOP-GON (09/11/2026): MỘT dải duy nhất cho mỗi vùng. `scope` nói dải này của vùng nào: "de-thi" do (noi-dung)/layout.tsx vẽ, "quan-lop" do layout lồng
// quan-lop/[id]/layout.tsx vẽ (sau đầu lớp). Dải chỉ hiện khi đường đang mở thuộc đúng vùng — nhờ vậy layout cha không vẽ thêm một dải thứ hai trên trang lớp.
// `role` (đồng giảng / bộ môn) → chỉ "Giáo trình · Lịch học". Tự bọc <Suspense> vì đọc ?tab= (useSearchParams). Tab đang sáng được kéo vào khung nhìn (điện thoại: dải cuộn ngang).
"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import { contentTabsFor, type ContentTabRole } from "@/lib/tutorRoutes";

export type ContentTabsScope = "de-thi" | "quan-lop";
const SCOPE_ROOT: Record<ContentTabsScope, string> = { "de-thi": "/lop-cua-toi/de-thi", "quan-lop": "/lop-cua-toi/quan-lop" };

function Strip({ scope, role }: { scope: ContentTabsScope; role?: ContentTabRole }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const ref = useRef<HTMLElement>(null);
  const inScope = pathname === SCOPE_ROOT[scope] || pathname.startsWith(SCOPE_ROOT[scope] + "/");
  const group = inScope ? contentTabsFor(pathname, tab, role ?? null) : null;
  const activeHref = group?.tabs.find(t => t.active)?.href ?? null;

  // Điện thoại: tab sáng có thể nằm ngoài khung nhìn của dải cuộn ngang → kéo nó vào giữa (chỉ cuộn dải, không cuộn cả trang).
  useEffect(() => {
    const nav = ref.current;
    if (!nav || !activeHref) return;
    const el = nav.querySelector<HTMLElement>("[aria-current=page]");
    if (!el) return;
    const left = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
    nav.scrollLeft = Math.max(0, left);
  }, [activeHref, pathname]);

  if (!group) return null;
  return (
    <nav ref={ref} aria-label={`Trang của ${group.label}`} className="flex items-stretch gap-1 px-3 border-b border-[var(--kin-vien-thuong)] overflow-x-auto flex-shrink-0 bg-[var(--kin-nen-trang)] print:hidden">
      {group.tabs.map(t => (
        <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={KIN_TAB_BOX}>
          <KinTabInner active={t.active}>{t.label}</KinTabInner>
        </Link>
      ))}
    </nav>
  );
}

export default function TutorContentTabs({ scope, role }: { scope: ContentTabsScope; role?: ContentTabRole }) {
  return <Suspense fallback={null}><Strip scope={scope} role={role} /></Suspense>;
}
