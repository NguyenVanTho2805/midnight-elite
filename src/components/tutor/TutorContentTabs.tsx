// BU-00 bước 3 — dải tab trang con của vỏ NỘI DUNG gia sư (/lop-cua-toi/de-thi*, /lop-cua-toi/quan-lop/[id]*), thay AdminTabStrip của vỏ quản trị.
// Là ĐIỀU HƯỚNG giữa các trang (Link + aria-current), không phải tab đổi nội dung → dùng KIN_TAB_BOX + KinTabInner như AdminShell, không role=tab.
// GS-LOP-GON (09/11/2026): MỘT dải duy nhất cho mỗi vùng. `scope` nói dải này của vùng nào: "de-thi" do (noi-dung)/layout.tsx vẽ, "quan-lop" do layout lồng
// quan-lop/[id]/layout.tsx vẽ (sau đầu lớp). Dải chỉ hiện khi đường đang mở thuộc đúng vùng — nhờ vậy layout cha không vẽ thêm một dải thứ hai trên trang lớp.
// LOI-02 (11/11/2026): dải của lớp còn đúng 4 tab "Bài học · Học sinh · Điểm danh · Cài đặt" (Giáo trình, Bài tập, Lịch học đã bỏ — contentTabsFor ở tutorRoutes.ts);
// …/lich-hoc vẫn mở bằng link và không tab nào sáng. `role` (đồng giảng / bộ môn) → chỉ "Bài học". Tự bọc <Suspense> vì đọc ?tab= (useSearchParams). Tab đang sáng được kéo vào khung nhìn (điện thoại: dải cuộn ngang).
"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import { contentTabsFor, type ContentTabRole } from "@/lib/tutorRoutes";
import { isLinkHidden } from "@/lib/features";

export type ContentTabsScope = "de-thi" | "quan-lop";
const SCOPE_ROOT: Record<ContentTabsScope, string> = { "de-thi": "/lop-cua-toi/de-thi", "quan-lop": "/lop-cua-toi/quan-lop" };

function Strip({ scope, role }: { scope: ContentTabsScope; role?: ContentTabRole }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const ref = useRef<HTMLDivElement>(null);
  const moreBox = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) { setOpenedAt(pathname); setMoreOpen(false); } // đổi trang ⇒ đóng "Khác"
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
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => { if (moreBox.current && !moreBox.current.contains(e.target as Node)) setMoreOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  if (!group) return null;
  // DG (14/11/2026): tab dẫn vào phần đang ẩn (Điểm danh — cờ DIEM_DANH, src/lib/features.ts) không hiện; route đã chặn 307 ở proxy.
  const tabs = group.tabs.filter(t => !isLinkHidden(t.href));
  // SCL-G-GS (§3.4): dải chỉ "Bài học / Học sinh / Điểm"; trang phụ (Video, Thông báo, Cài đặt…) vào qua "Khác", trang phụ đang mở thì vẫn hiện trên dải.
  const shown = tabs.filter(t => !t.more || t.active);
  const more = tabs.filter(t => t.more && !t.active);
  return (
    <nav aria-label={`Trang của ${group.label}`} className="flex items-stretch border-b border-[var(--kin-vien-thuong)] flex-shrink-0 bg-[var(--kin-nen-trang)] print:hidden">
      <div ref={ref} className="flex min-w-0 items-stretch gap-1 px-3 overflow-x-auto">
        {shown.map(t => (
          <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className={KIN_TAB_BOX}>
            <KinTabInner active={t.active}>{t.label}</KinTabInner>
          </Link>
        ))}
      </div>
      {more.length > 0 && (
        <div ref={moreBox} className="relative flex-shrink-0"
          onKeyDown={e => { if (e.key === "Escape" && moreOpen) { e.stopPropagation(); setMoreOpen(false); moreBtn.current?.focus(); } }}>
          <button ref={moreBtn} type="button" data-tab-khac aria-expanded={moreOpen} aria-controls="dai-tab-khac" onClick={() => setMoreOpen(o => !o)} className={KIN_TAB_BOX}>
            <KinTabInner active={false}>Khác ▾</KinTabInner>
          </button>
          {moreOpen && (
            <ul id="dai-tab-khac" className="absolute right-0 top-full z-30 mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] py-1 shadow-[var(--kin-bong-noi)]">
              {more.map(t => (
                <li key={t.href}><Link href={t.href} onClick={() => setMoreOpen(false)}
                  className="flex min-h-11 items-center px-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]">{t.label}</Link></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </nav>
  );
}

export default function TutorContentTabs({ scope, role }: { scope: ContentTabsScope; role?: ContentTabRole }) {
  return <Suspense fallback={null}><Strip scope={scope} role={role} /></Suspense>;
}
