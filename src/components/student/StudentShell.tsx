// Vỏ của học sinh (Figma "Vỏ — Học sinh" 11:98): thanh module bên trái (điện thoại: thanh dưới) với 4 module đúng Figma
// — Việc của tôi, Lịch, Lớp, Thư viện — cộng "Khác" cho các trang còn lại (thi thử, xếp hạng, cộng đồng, học phí, hồ sơ…) để không
// trang nào mất lối vào khi bỏ thanh trên cũ. Phòng thi (/student/thi-thu/<mã đề>) KHÔNG có vỏ: toàn màn hình, khoá cứng.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CoinBalance from "@/components/CoinBalance";
import NotificationBell from "@/components/NotificationBell";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem } from "@/components/kin/shell/ModuleRail";

const MORE_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Học tập", links: [
    { label: "Thi thử", href: "/student/thi-thu" },
    { label: "Bảng xếp hạng", href: "/student/bang-xep-hang" },
    { label: "Hỏi đáp", href: "/student/hoi-dap" },
    { label: "Cộng đồng", href: "/student/cong-dong" },
  ] },
  { title: "Khám phá", links: [
    { label: "Khoá học đang mở", href: "/khoa-hoc" },
    { label: "Lớp đang theo dõi", href: "/khoa-hoc-da-luu" },
    { label: "Gia sư", href: "/giang-vien" },
    { label: "Tin tức", href: "/student/tin-tuc" },
    { label: "Tra cứu điểm chuẩn", href: "/diem-chuan" },
  ] },
  { title: "Tài khoản", links: [
    { label: "Hồ sơ", href: "/student/ho-so" },
    { label: "Học phí", href: "/student/hoc-phi" },
    { label: "Ví và Coin", href: "/student/vi" },
    { label: "Chủ đề màu", href: "/cai-dat/chu-de" },
  ] },
];
const MORE_HREFS = MORE_GROUPS.flatMap(g => g.links.map(l => l.href));
const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
/** Phòng thi: /student/thi-thu/<mã đề> (không tính danh sách /student/thi-thu). */
export const isExamRoom = (pathname: string) => /^\/student\/thi-thu\/[^/]+/.test(pathname);

export default function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [badge, setBadge] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const exam = isExamRoom(pathname);

  const loadBadge = useCallback(() => {
    fetch("/api/student/viec-cua-toi?badge=1", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.badge === "number") setBadge(d.badge); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (exam) return;
    loadBadge();
    const onFocus = () => loadBadge();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname, exam, loadBadge]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current && !panelRef.current.contains(t) && !t.closest("[data-khac-nut]")) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [moreOpen]);

  if (exam) return <>{children}</>;

  const moreActive = moreOpen || MORE_HREFS.some(h => isUnder(pathname, h));
  const modules: ModuleItem[] = [
    { key: "viec", label: "Việc của tôi", href: "/student/viec-cua-toi", icon: "viec", badge },
    { key: "lich", label: "Lịch", href: "/student/lich-hoc", icon: "lich" },
    { key: "lop", label: "Lớp", href: "/student/hoc-tap", also: ["/student/bai-giang", "/student/nhap-ma-lop"], icon: "lop" },
    { key: "thu-vien", label: "Thư viện", href: "/thu-vien", icon: "thu-vien" },
    { key: "khac", label: "Khác", icon: "khac", onClick: () => setMoreOpen(o => !o), active: moreActive, controls: "khac-bang", expanded: moreOpen },
  ];

  return (
    <div className="md:flex min-h-screen bg-[var(--kin-nen-trang)]" style={{ ["--kin-top" as string]: "48px" }}>
      <ModuleRail roleLabel="HỌC SINH" ariaLabel="Module của học sinh" modules={modules} />

      <div className="flex-1 min-w-0 pb-[60px] md:pb-0 relative">
        <VerifyEmailBanner />
        <div className="h-12 flex items-center justify-between gap-3 px-4 border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
          <Link href="/student/viec-cua-toi" aria-label="KiN — Việc của tôi" className="inline-flex"><KinLogo size={24} textSize="var(--kin-co-body)" /></Link>
          <div className="flex items-center gap-2">
            <CoinBalance />
            <NotificationBell />
          </div>
        </div>
        {children}
      </div>

      {moreOpen && (
        <div
          id="khac-bang"
          ref={panelRef}
          role="dialog"
          aria-label="Các mục khác"
          className="fixed z-40 left-3 right-3 bottom-[68px] md:left-[87px] md:right-auto md:bottom-4 md:w-[280px] max-h-[75vh] overflow-y-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-2"
          style={{ boxShadow: "0 12px 32px rgba(17,24,39,0.14)" }}
        >
          {user && (
            <div className="px-3 pt-2 pb-2 border-b border-[var(--kin-vien-nhat)] mb-1">
              <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] truncate">{user.name}</p>
              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] truncate">{user.email}</p>
            </div>
          )}
          {MORE_GROUPS.map(g => (
            <div key={g.title} className="py-1">
              <p className="px-3 pt-1 pb-1 text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.09em] text-[var(--kin-chu-mo)]">{g.title}</p>
              {g.links.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)}
                  aria-current={isUnder(pathname, l.href) ? "page" : undefined}
                  className="flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
                  style={isUnder(pathname, l.href) ? { background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" } : undefined}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="pt-1 mt-1 border-t border-[var(--kin-vien-nhat)]">
            <button type="button" onClick={() => { setMoreOpen(false); void logout(); }}
              className="w-full flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-left text-[length:var(--kin-co-small)] font-medium text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
