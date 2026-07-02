"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

const navLinks = [
  { label: "Khóa học",      href: "/khoa-hoc"           },
  { label: "Thi thử ĐGNL",  href: "/thi-thu"             },
  { label: "Cộng đồng",     href: "/student/cong-dong"   },
  { label: "Tra cứu",       href: "/tra-cuu"             },
  { label: "Bảng xếp hạng", href: "/bang-xep-hang"       },
  { label: "Tin tức",       href: "/tin-tuc"             },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    setMenuOpen(false);
    logout();
  }

  function goToDashboard() {
    router.push(user?.role === "admin" ? "/admin" : "/student");
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
          {user ? (
            <>
              <button
                onClick={goToDashboard}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#f6f5f4] transition-colors"
                style={{ color: "#1a1a1a" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #0068FF, #2680FF)" }}
                >
                  {user.avatar}
                </div>
                {user.name.split(" ").pop()}
              </button>
              <button
                onClick={handleLogout}
                className="notion-btn-secondary text-sm"
                style={{ color: "#787671" }}
              >
                Đăng xuất
              </button>
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
          <div className="flex gap-2 pt-2 border-t mt-2" style={{ borderColor: "#e5e3df" }}>
            {user ? (
              <>
                <button
                  onClick={goToDashboard}
                  className="flex-1 py-2 rounded-md text-sm font-medium text-center hover:bg-[#f6f5f4]"
                  style={{ color: "#0068FF" }}
                >
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2 rounded-md text-sm font-medium text-center border hover:bg-[#f6f5f4]"
                  style={{ color: "#787671", borderColor: "#c8c4be" }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dang-nhap"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2 rounded-md text-sm font-medium text-center hover:bg-[#f6f5f4]"
                  style={{ color: "#1a1a1a" }}
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/dang-ky"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 py-2 rounded-md text-sm font-bold text-white text-center"
                  style={{ background: "#0068FF", borderRadius: "8px" }}
                >
                  Bắt đầu
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
