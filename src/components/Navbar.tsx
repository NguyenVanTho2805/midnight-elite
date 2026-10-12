"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CoinBalance from "@/components/CoinBalance";
import NotificationBell from "@/components/NotificationBell";
import { KinLogo } from "@/components/kin/KinLogo";

// Figma KiN 146:2 "Header": 4 mục, khách và người đã đăng nhập thấy như nhau.
const navLinks = [
  { label: "Lớp học",   href: "/khoa-hoc"  },
  { label: "Thi thử",   href: "/thi-thu"   },
  { label: "Cộng đồng", href: "/cong-dong" },
  { label: "Tin tức",   href: "/tin-tuc"   },
];

const accountLinks = [
  { label: "Thông tin cá nhân", href: "/student/ho-so",     icon: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
  { label: "Khoá học của tôi",  href: "/student/hoc-tap",   icon: <><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></> },
  { label: "Lịch học",          href: "/student/lich-hoc",  icon: <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/> },
  { label: "Lớp đang theo dõi", href: "/khoa-hoc-da-luu",   icon: <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/> },
];

const ghostBtn = "inline-flex items-center justify-center h-11 px-[18px] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] transition-colors hover:bg-[var(--kin-nen-bang)]";
const solidBtn = "inline-flex items-center justify-center h-11 px-[18px] rounded-[var(--kin-bo-md)] bg-[var(--kin-nhan-nen)] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-chu-tren-nen)] transition-colors hover:bg-[var(--kin-nhan-nen-re)]";

export default function Navbar() {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [dropdownOpen, setDropdown]   = useState(false);
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleLogout() {
    setMenuOpen(false);
    setDropdown(false);
    logout();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      data-vung="khach-sang"
      className="kin-chu-than sticky top-0 z-50 h-[60px] bg-[var(--kin-nen-trang)] border-b border-[var(--kin-vien-thuong)]"
    >
      <div className="mx-auto h-full flex items-center justify-between gap-4 px-4 sm:px-8 max-w-[1440px]">

        {/* Logo */}
        <Link href="/" aria-label="KiN — trang chủ" className="flex items-center flex-shrink-0">
          <KinLogo />
        </Link>

        {/* Desktop nav links */}
        <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-1">
          {navLinks.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "px-[14px] py-[10px] rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-medium transition-colors hover:bg-[var(--kin-nen-re-chuot)]",
                  active ? "text-[var(--kin-chu-chinh)] bg-[var(--kin-nen-re-chuot)]" : "text-[var(--kin-chu-phu)]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Auth area */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="w-[108px] h-11 rounded-[var(--kin-bo-md)] animate-pulse bg-[var(--kin-nen-re-chuot)]" />
              <div className="w-[89px] h-11 rounded-[var(--kin-bo-md)] animate-pulse bg-[var(--kin-nen-re-chuot)]" />
            </div>
          ) : user ? (
            <>
              <CoinBalance />
              <NotificationBell />

              {/* User dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdown(p => !p)}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  className="flex items-center gap-2 h-11 px-3 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)]"
                  >
                    {user.avatar}
                  </span>
                  <span className="max-w-[80px] truncate">{user.name.split(" ").pop()}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.15s", transform: dropdownOpen ? "rotate(180deg)" : "none" }}>
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 rounded-[var(--kin-bo-xl)] z-50 py-1 bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-thuong)]"
                    style={{ boxShadow: "0 8px 24px rgba(17,24,39,0.10)" }}
                  >
                    {accountLinks.map((l) => (
                      <Link key={l.href} href={l.href} role="menuitem" onClick={() => setDropdown(false)}
                        className="flex items-center gap-2.5 px-4 min-h-11 text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--kin-chu-mo)]" style={{ flexShrink: 0 }}>{l.icon}</svg>
                        {l.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-[var(--kin-vien-thuong)]" />
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 min-h-11 text-[length:var(--kin-co-small)] font-medium text-left text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/dang-nhap" className={ghostBtn}>Đăng nhập</Link>
              <Link href="/dang-ky" className={solidBtn}>Đăng ký</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-11 h-11 -mr-2 flex flex-col items-center justify-center rounded-[var(--kin-bo-sm)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
        >
          <span className="block w-5 h-0.5 bg-[var(--kin-chu-phu)] mb-1 transition-all" style={{ transform: menuOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
          <span className="block w-5 h-0.5 bg-[var(--kin-chu-phu)] mb-1" style={{ opacity: menuOpen ? 0 : 1 }} />
          <span className="block w-5 h-0.5 bg-[var(--kin-chu-phu)] transition-all" style={{ transform: menuOpen ? "rotate(-45deg) translate(4px, -4px)" : "none" }} />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-3 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className="flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-[var(--kin-vien-thuong)] space-y-1">
            {user ? (
              <>
                {accountLinks.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                    className="flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-left text-[length:var(--kin-co-small)] font-medium text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Link href="/dang-nhap" onClick={() => setMenuOpen(false)} className={`${ghostBtn} flex-1`}>Đăng nhập</Link>
                <Link href="/dang-ky" onClick={() => setMenuOpen(false)} className={`${solidBtn} flex-1`}>Đăng ký</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
