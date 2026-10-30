// Vỏ quản trị kiểu Outlook (Figma "Vỏ — Quản trị" 11:287): thanh module trái (điện thoại: thanh dưới 60px), dải trên có logo + tên người dùng,
// dải tab các trang con của module đang ở. Giữ NGUYÊN mọi trang quản trị cũ và quyền của từng trang (xem src/lib/adminNav.ts).
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth, getAdminRoleLabel } from "@/contexts/AuthContext";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem, type NavGroup } from "@/components/kin/shell/ModuleRail";
import { TopDate } from "@/components/kin/shell/TopDate";
import { RailOpenButton } from "@/components/kin/shell/RailOpenButton";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import { QUEUE_CHANGED } from "@/components/admin/KiemDuyet";
import { matchSub, visibleModules, type AdminSub } from "@/lib/adminNav";
import { MAIN_HOST } from "@/lib/hostRouting";

const STRIP = 48, TABS = 44;

/** Dải tab các trang con của module đang ở. Dùng chung cho vỏ quản trị và vỏ gia sư (gia sư mở các trang /admin/* ngay trên tên miền chính). */
export function AdminTabStrip({ label, tabs, activeHref }: { label: string; tabs: AdminSub[]; activeHref?: string }) {
  return (
    <nav aria-label={`Trang của ${label}`} className="flex items-stretch gap-1 px-3 border-b border-[var(--kin-vien-thuong)] overflow-x-auto flex-shrink-0" style={{ height: TABS }}>
      {tabs.map(t => {
        const active = activeHref === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={KIN_TAB_BOX}>
            <KinTabInner active={active}>{t.label}</KinTabInner>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [badge, setBadge] = useState(0);

  const loadBadge = useCallback(() => {
    fetch("/api/admin/kiem-duyet?badge=1", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.badge === "number") setBadge(d.badge); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadBadge();
    window.addEventListener("focus", loadBadge);
    window.addEventListener(QUEUE_CHANGED, loadBadge);
    return () => { window.removeEventListener("focus", loadBadge); window.removeEventListener(QUEUE_CHANGED, loadBadge); };
  }, [pathname, loadBadge]);

  const hit = matchSub(pathname);
  const modules = visibleModules(user?.adminRole);
  const current = modules.find(m => m.key === hit?.moduleKey) ?? null;
  const tabs = current && current.subs.length > 1 ? current.subs : null;
  // Chiều cao dải trên + dải tab: các khung Outlook trong trang trừ đi để vừa khít màn hình, không sinh thanh cuộn của trang.
  const top = STRIP + (tabs ? TABS : 0);
  const flush = pathname === "/admin/kiem-duyet";

  const items: ModuleItem[] = modules.map(m => ({
    key: m.key, label: m.label, href: m.href, icon: m.icon, active: m.key === current?.key,
    ...(m.key === "kiem-duyet" ? { badge } : {}),
  }));

  // Thanh RỘNG (Figma "Điều hướng" của quản trị, 25/10/2026): mỗi module là một NHÓM, các trang con là mục (biểu tượng của module); dải tab các trang con vẫn giữ ở đầu trang.
  const wide: NavGroup[] = modules.map(m => ({
    title: m.label,
    items: m.subs.map(s => ({ key: s.href, label: s.label, href: s.href, icon: m.icon, active: hit?.sub.href === s.href, ...(s.href === "/admin/kiem-duyet" ? { badge } : {}) })),
  }));

  return (
    <div className="md:flex h-screen overflow-hidden bg-[var(--kin-nen-trang)]" style={{ ["--kin-top" as string]: `${top}px` }}>
      <ModuleRail roleLabel="QUẢN TRỊ" ariaLabel="Module quản trị" modules={items} groups={wide}
        home={{ href: "/admin", label: "KiN — Tổng quan quản trị" }} footnote="Miễn phí ra mắt" />
      <div className="flex-1 min-w-0 flex flex-col h-[calc(100vh-60px)] md:h-screen">
        <div className="flex items-center justify-between gap-3 px-4 border-b border-[var(--kin-vien-thuong)] flex-shrink-0" style={{ height: STRIP }}>
          <div className="flex items-center gap-1 min-w-0">
            <RailOpenButton pending={badge} />
            <Link href="/admin" aria-label="KiN — Tổng quan quản trị" className="inline-flex md:hidden"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
            <p data-top-title className="hidden md:block truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Quản trị KiN</p>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <TopDate />
            {/* BU-00 bước 4: "Xem thử trang học sinh" — khu học sinh ở tên miền chính, cookie không dùng chung hai tên miền (src/lib/hostRouting.ts) nên đi qua
                /dang-nhap?redirect= ở đó rồi vào thẳng Việc của tôi (vỏ học sinh hiện băng "Đang xem thử"). Dùng <a>, không <Link> (điều hướng khác nguồn). */}
            <a href={`https://${MAIN_HOST}/dang-nhap?redirect=${encodeURIComponent("/student/viec-cua-toi")}`} target="_blank" rel="noopener noreferrer" data-preview-student
              className="hidden md:inline-flex items-center min-h-11 px-2 text-[length:var(--kin-co-small)] font-medium text-[var(--kin-nhan-link)] hover:underline">Xem thử trang học sinh</a>
            <span className="hidden sm:inline-flex items-center px-2 py-[2px] rounded-full border border-[var(--kin-vien-thuong)] text-[length:var(--kin-co-caption)] font-semibold text-[var(--kin-chu-phu)]">{getAdminRoleLabel(user?.adminRole)}</span>
            <span className="hidden sm:block truncate max-w-[160px] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{user?.name ?? "Admin"}</span>
            <button type="button" onClick={() => void logout()}
              className="inline-flex items-center min-h-11 px-2 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-tt-chu-loi)] hover:underline">Đăng xuất</button>
          </div>
        </div>
        {tabs && <AdminTabStrip label={current!.label} tabs={tabs} activeHref={hit?.sub.href} />}
        <main className={`flex-1 min-h-0 overflow-auto ${flush ? "" : "p-4 sm:p-6"}`}>{children}</main>
      </div>
    </div>
  );
}
