"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import StudentBottomNav from "@/components/StudentBottomNav";
import NotificationBell from "@/components/NotificationBell";
import CoinBalance from "@/components/CoinBalance";
import AIChatWidget from "@/components/AIChatWidget";
import SalesBotWidget from "@/components/SalesBotWidget";
import AuthGuard from "@/components/AuthGuard";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";

const navItems = [
  { label: "Khóa học",   href: "/student"               },
  { label: "Thi thử",    href: "/student/thi-thu"       },
  { label: "Xếp hạng",  href: "/student/bang-xep-hang" },
  { label: "Tin tức",   href: "/student/tin-tuc"        },
  { label: "Cộng đồng", href: "/student/cong-dong"      },
  { label: "Tra cứu",   href: "/student/tra-cuu"        },
];

// ─── USER DROPDOWN PANEL ─────────────────────────────────────────────────────
function UserPanel() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-[#f6f5f4]"
        style={{
          border: "1px solid #e5e3df",
          background: open ? "#f6f5f4" : "#ffffff",
        }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0068FF, #2680FF)" }}>
          {user?.avatar ?? "?"}
        </div>
        <span className="text-sm font-semibold max-w-[100px] truncate" style={{ color: "#1E2938" }}>
          {user?.name}
        </span>
        <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ color: "#9CA3AF", transform: open ? "rotate(180deg)" : "none" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl z-50 overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.1) 0px 4px 16px 0px" }}>

          {/* User info */}
          <div className="p-4 flex items-center gap-3" style={{ borderBottom: "1px solid #e5e3df" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0068FF, #2680FF)" }}>
              {user?.avatar ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-sm truncate" style={{ color: "#1E2938" }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ background: "#0068FF" }}>Học viên</span>
            </div>
          </div>

          {/* Hồ sơ */}
          <Link href="/student/ho-so" onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/60"
            style={{ borderBottom: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#f6f5f4" }}>
                <svg className="w-4 h-4" fill="none" stroke="#0068FF" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: "#1E2938" }}>Hồ sơ học viên</span>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="#9CA3AF" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Tra cứu */}
          <Link href="/student/tra-cuu" onClick={() => setOpen(false)}
            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/60"
            style={{ borderBottom: "1px solid #e5e3df" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#f6f5f4" }}>
                <svg className="w-4 h-4" fill="none" stroke="#0068FF" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: "#1E2938" }}>Tra cứu học viên</span>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="#9CA3AF" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Đăng xuất */}
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-red-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#FEE2E2" }}>
              <svg className="w-4 h-4" fill="none" stroke="#FF2157" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "#FF2157" }}>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────
function StudentHeader() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop */}
      <header className="notion-nav hidden md:flex items-center justify-between px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/" title="Trang chủ"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#f6f5f4]"
            style={{ border: "1px solid #e5e3df" }}>
            <svg className="w-4 h-4" fill="none" stroke="#787671" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
          </Link>
          <Link href="/student" className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: "#0068FF" }}>Midnight Elite</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: "#0068FF" }}>Học viên</span>
          </Link>
        </div>
        <nav className="flex items-center gap-0.5 flex-1 ml-6">
          {navItems.map(item => {
            const active = pathname === item.href || (item.href !== "/student" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  color: active ? "#1a1a1a" : "#787671",
                  background: active ? "#f6f5f4" : "transparent",
                }}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <CoinBalance />
          <NotificationBell />
          <UserPanel />
        </div>
      </header>

      {/* Mobile */}
      <header className="notion-nav flex md:hidden items-center justify-between px-4 h-14 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Link href="/" title="Trang chủ"
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ border: "1px solid #e5e3df" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="#787671" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
          </Link>
          <Link href="/student">
            <span className="text-base font-bold" style={{ color: "#0068FF" }}>Midnight Elite</span>
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <CoinBalance />
          <NotificationBell />
          <UserPanel />
        </div>
      </header>
    </>
  );
}

// ─── CHAT WIDGET THEO TRẠNG THÁI MUA HÀNG ────────────────────────────────────
// Học viên CHƯA mua khóa học nào vẫn là lead chưa chốt — hiện sales bot để
// tiếp tục tư vấn/chốt đơn, thay vì bot hỏi đáp học thuật (chỉ dành cho người
// đã mua, đang học thật). Đã mua >=1 khóa thì hiện bot học thuật như cũ.
function StudentChatWidget() {
  const { enrolledIds, loading } = useEnrollments();
  if (loading) return null;
  return enrolledIds.size > 0 ? <AIChatWidget /> : <SalesBotWidget />;
}

// ─── LAYOUT ──────────────────────────────────────────────────────────────────
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="student">
      <div className="min-h-screen" style={{ background: "#ffffff" }}>
        <VerifyEmailBanner />
        <StudentHeader />
        <main className="pb-24 md:pb-8 px-4 md:px-8 py-6 max-w-6xl mx-auto">
          <Suspense fallback={
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl" style={{ background: "#e5e3df" }} />
              ))}
            </div>
          }>
            <div className="page-enter">{children}</div>
          </Suspense>
        </main>
        <StudentBottomNav />
        <StudentChatWidget />
      </div>
    </AuthGuard>
  );
}
