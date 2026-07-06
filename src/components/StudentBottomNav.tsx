"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  {
    iconPath: "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5",
    label: "Khóa học",
    href: "/khoa-hoc",
  },
  {
    iconPath: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z",
    label: "Thi thử",
    href: "/thi-thu",
  },
  {
    iconPath: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
    label: "Tin tức",
    href: "/tin-tuc",
  },
  {
    iconPath: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
    label: "Cộng đồng",
    href: "/cong-dong",
  },
];

export default function StudentBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const profileActive =
    pathname === "/student/ho-so" ||
    pathname.startsWith("/student/ho-so");

  return (
    <nav
      className="fixed z-50 flex md:hidden items-center"
      style={{
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(240, 245, 255, 0.88)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderRadius: "999px",
        boxShadow: "0 -2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(197,208,234,0.5)",
        height: 60,
        padding: "0 8px",
      }}
    >
      {/* Regular nav items */}
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const color = active ? "#0068FF" : "#9CA3AF";
        return (
          <Link
            key={item.href}
            href={item.href}
            className="w-14 h-full flex flex-col items-center justify-center gap-0.5 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke={color} strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
            </svg>
            <span className="text-[10px] font-semibold" style={{ color }}>
              {item.label}
            </span>
            {active && <span className="w-1 h-1 rounded-full" style={{ background: "#0068FF" }} />}
          </Link>
        );
      })}

      {/* Profile tab */}
      <Link
        href="/student/ho-so"
        className="w-14 h-full flex flex-col items-center justify-center gap-0.5 transition-all"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{
            background: profileActive
              ? "linear-gradient(135deg, #0068FF, #2680FF)"
              : "linear-gradient(135deg, #9CA3AF, #6B7280)",
            boxShadow: profileActive ? "0 0 0 2px rgba(0,104,255,0.25)" : "none",
          }}
        >
          {user?.avatar ?? "?"}
        </div>
        <span className="text-[10px] font-semibold" style={{ color: profileActive ? "#0068FF" : "#9CA3AF" }}>
          Tài khoản
        </span>
        {profileActive && <span className="w-1 h-1 rounded-full" style={{ background: "#0068FF" }} />}
      </Link>
    </nav>
  );
}
