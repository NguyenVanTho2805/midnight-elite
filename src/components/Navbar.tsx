"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import CoinBalance from "@/components/CoinBalance";
import NotificationBell from "@/components/NotificationBell";

const guestNavLinks = [
  { label: "Khóa học",      href: "/khoa-hoc"           },
  { label: "Gia sư",        href: "/giang-vien"         },
  { label: "Thi thử ĐGNL",  href: "/thi-thu"            },
  { label: "Bảng xếp hạng", href: "/bang-xep-hang"      },
  { label: "Tin tức",       href: "/tin-tuc"            },
];

const studentNavLinks = [
  { label: "Khóa học",      href: "/khoa-hoc"           },
  { label: "Gia sư",        href: "/giang-vien"         },
  { label: "Thi thử ĐGNL",  href: "/thi-thu"            },
  { label: "Cộng đồng",     href: "/cong-dong"           },
  { label: "Bảng xếp hạng", href: "/bang-xep-hang"      },
  { label: "Tin tức",       href: "/tin-tuc"            },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [dropdownOpen, setDropdown]   = useState(false);
  const { user, isLoading, logout } = useAuth();
  const navLinks = (isLoading || user) ? studentNavLinks : guestNavLinks;
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

  return (
    <header className="notion-nav sticky top-0 z-50 h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
            style={{ background: "#0068FF" }}
          >
            ME
          </div>
          <span className="font-bold text-base hidden sm:block" style={{ color: "#1a1a1a" }}>
            Midnight <span style={{ color: "#0068FF" }}>Elite</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-[#f6f5f4]"
              style={{ color: "#5d5b54" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Auth area */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-8 rounded-lg animate-pulse" style={{ background: "#f0eeec" }} />
              <div className="w-9 h-9 rounded-lg animate-pulse" style={{ background: "#f0eeec" }} />
              <div className="w-24 h-9 rounded-md animate-pulse" style={{ background: "#f0eeec" }} />
            </div>
          ) : user ? (
            <>
              <CoinBalance />
              <NotificationBell />

              {/* User dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdown(p => !p)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                  style={{ color: "#1a1a1a" }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #0068FF, #2680FF)" }}
                  >
                    {user.avatar}
                  </div>
                  <span className="max-w-[80px] truncate">{user.name.split(" ").pop()}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.15s", transform: dropdownOpen ? "rotate(180deg)" : "none" }}>
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-xl z-50 py-1"
                    style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.1) 0px 4px 16px 0px" }}
                  >
                    <Link href="/student/ho-so" onClick={() => setDropdown(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                      style={{ color: "#37352f" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a4a097", flexShrink: 0 }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      Thông tin cá nhân
                    </Link>
                    <Link href="/student/hoc-tap" onClick={() => setDropdown(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                      style={{ color: "#37352f" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a4a097", flexShrink: 0 }}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                      Khoá học của tôi
                    </Link>
                    <Link href="/khoa-hoc-da-luu" onClick={() => setDropdown(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                      style={{ color: "#37352f" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a4a097", flexShrink: 0 }}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61H19a2 2 0 001.97-1.67L23 6H6"/></svg>
                      Khóa học đã lưu
                    </Link>
                    <div className="my-1" style={{ borderTop: "1px solid #e5e3df" }} />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-[#FEF2F2] transition-colors text-left"
                      style={{ color: "#dc2626" }}
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
              <Link
                href="/dang-nhap"
                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                style={{ color: "#1a1a1a" }}
              >
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                className="notion-btn-primary text-sm"
              >
                Bắt đầu miễn phí
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md hover:bg-[#f6f5f4] transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
        >
          <div className="w-5 h-0.5 bg-[#787671] mb-1 transition-all" style={{ transform: menuOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
          <div className="w-5 h-0.5 bg-[#787671] mb-1" style={{ opacity: menuOpen ? 0 : 1 }} />
          <div className="w-5 h-0.5 bg-[#787671] transition-all" style={{ transform: menuOpen ? "rotate(-45deg) translate(4px, -4px)" : "none" }} />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-4 py-3 space-y-1"
          style={{ background: "#ffffff", borderColor: "#e5e3df" }}
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
              style={{ color: "#37352f" }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 border-t mt-2 space-y-1" style={{ borderColor: "#e5e3df" }}>
            {user ? (
              <>
                <Link href="/student/ho-so" onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                  style={{ color: "#37352f" }}>
                  Thông tin cá nhân
                </Link>
                <Link href="/student/hoc-tap" onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                  style={{ color: "#37352f" }}>
                  Khoá học của tôi
                </Link>
                <Link href="/khoa-hoc-da-luu" onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                  style={{ color: "#37352f" }}>
                  Khóa học đã lưu
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#FEF2F2] transition-colors"
                  style={{ color: "#dc2626" }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dang-nhap"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                  style={{ color: "#1a1a1a" }}
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/dang-ky"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-bold text-white text-center"
                  style={{ background: "#0068FF" }}
                >
                  Bắt đầu miễn phí
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
