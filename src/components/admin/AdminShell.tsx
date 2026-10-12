// Vỏ quản trị kiểu Outlook (Figma "Vỏ — Quản trị" 11:287): thanh module trái (điện thoại: thanh dưới 60px), dải trên có logo + tên người dùng,
// dải tab các trang con của module đang ở. Giữ NGUYÊN mọi trang quản trị cũ và quyền của từng trang (xem src/lib/adminNav.ts).
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth, getAdminRoleLabel } from "@/contexts/AuthContext";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem } from "@/components/kin/shell/ModuleRail";
import { QUEUE_CHANGED } from "@/components/admin/KiemDuyet";
import { matchSub, visibleModules } from "@/lib/adminNav";

const STRIP = 48, TABS = 44;

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

  return (
    <div className="md:flex h-screen overflow-hidden bg-[var(--kin-nen-trang)]" style={{ ["--kin-top" as string]: `${top}px` }}>
      <ModuleRail roleLabel="QUẢN TRỊ" ariaLabel="Module quản trị" modules={items} />
      <div className="flex-1 min-w-0 flex flex-col h-[calc(100vh-60px)] md:h-screen">
        <div className="flex items-center justify-between gap-3 px-4 border-b border-[var(--kin-vien-thuong)] flex-shrink-0" style={{ height: STRIP }}>
          <Link href="/admin" aria-label="KiN — Tổng quan quản trị" className="inline-flex"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
          <div className="flex items-center gap-3 min-w-0">
            {/* Trang học viên nằm ở tên miền riêng (midnightelite-edu.com): dùng <a>, không dùng <Link> (điều hướng khác nguồn). */}
            <a href="https://midnightelite-edu.com/student" target="_blank" rel="noopener noreferrer"
              className="hidden md:inline-flex items-center min-h-11 px-2 text-[length:var(--kin-co-small)] font-medium text-[var(--kin-nhan-link)] hover:underline">Trang học viên</a>
            <span className="hidden sm:inline-flex items-center px-2 py-[2px] rounded-full border border-[var(--kin-vien-thuong)] text-[length:var(--kin-co-caption)] font-semibold text-[var(--kin-chu-phu)]">{getAdminRoleLabel(user?.adminRole)}</span>
            <span className="hidden sm:block truncate max-w-[160px] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{user?.name ?? "Admin"}</span>
            <button type="button" onClick={() => void logout()}
              className="inline-flex items-center min-h-11 px-2 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-tt-chu-loi)] hover:underline">Đăng xuất</button>
          </div>
        </div>
        {tabs && (
          <nav aria-label={`Trang của ${current!.label}`} className="flex items-stretch gap-1 px-3 border-b border-[var(--kin-vien-thuong)] overflow-x-auto flex-shrink-0" style={{ height: TABS }}>
            {tabs.map(t => {
              const active = hit?.sub.href === t.href;
              return (
                <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
                  className="inline-flex items-center px-3 whitespace-nowrap text-[length:var(--kin-co-small)] font-medium border-b-2 transition-colors hover:text-[var(--kin-chu-chinh)]"
                  style={active ? { color: "var(--kin-th-navy)", borderColor: "var(--kin-th-navy)", fontWeight: 600 } : { color: "var(--kin-chu-mo)", borderColor: "transparent" }}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
        <main className={`flex-1 min-h-0 overflow-auto ${flush ? "" : "p-4 sm:p-6"}`}>{children}</main>
      </div>
    </div>
  );
}
