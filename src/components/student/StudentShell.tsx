// Vỏ của học sinh (Figma "Vỏ — Học sinh" 11:98): thanh module bên trái (điện thoại: thanh dưới) với 4 module đúng Figma
// — Việc của tôi, Lịch, Lớp, Thư viện — cộng "Khác" cho các trang còn lại (thi thử, xếp hạng, cộng đồng, học phí, hồ sơ…) để không
// trang nào mất lối vào khi bỏ thanh trên cũ. Phòng thi (/student/thi-thu/<mã đề>) KHÔNG có vỏ: toàn màn hình, khoá cứng.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CoinBalance from "@/components/CoinBalance";
import NotificationBell from "@/components/NotificationBell";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { KinLogo } from "@/components/kin/KinLogo";
import { ModuleRail, type ModuleItem } from "@/components/kin/shell/ModuleRail";
import { MorePanel, isUnder, type MoreGroup } from "@/components/kin/shell/MorePanel";

const MORE_GROUPS: MoreGroup[] = [
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
/** Phòng thi: /student/thi-thu/<mã đề> (không tính danh sách /student/thi-thu). */
export const isExamRoom = (pathname: string) => /^\/student\/thi-thu\/[^/]+/.test(pathname);

export default function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [badge, setBadge] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
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

  const closeMore = useCallback(() => setMoreOpen(false), []);
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

      {moreOpen && <MorePanel id="khac-bang" groups={MORE_GROUPS} onClose={closeMore} user={user} onLogout={() => void logout()} />}
    </div>
  );
}
