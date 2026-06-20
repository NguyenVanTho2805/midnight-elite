"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBar, BookOpen, ClipboardList, Badge,
  UsersGroup, Wallet, Edit, FileText, ChatCircle, Robot,
} from "griddy-icons";
import { useAuth, hasPermission, getAdminRoleLabel, PERMISSIONS, type Permission } from "@/contexts/AuthContext";
import type { FC } from "react";

type IconComponent = FC<{ size?: number; style?: React.CSSProperties }>;

interface NavItem {
  label:      string;
  href:       string;
  Icon:       IconComponent;
  permission?: Permission;
  children?:  { label: string; href: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",      href: "/admin",               Icon: ChartBar     },
  {
    label:      "Khóa học (CMS)",
    href:       "/admin/khoa-hoc",
    Icon:       BookOpen,
    permission: PERMISSIONS.MANAGE_COURSES,
    children: [
      { label: "Danh sách khoá học", href: "/admin/khoa-hoc" },
      { label: "Danh mục khoá học",  href: "/admin/khoa-hoc/danh-muc" },
    ],
  },
  {
    label:      "Thi thử",
    href:       "/admin/thi-thu",
    Icon:       ClipboardList,
    permission: PERMISSIONS.MANAGE_CURRICULUM,
    children: [
      { label: "Danh sách đề thi", href: "/admin/thi-thu" },
    ],
  },
  { label: "Bảng vinh danh",  href: "/admin/vinh-danh",       Icon: Badge,      permission: PERMISSIONS.MANAGE_HONOR    },
  { label: "Tin tức & Blog",  href: "/admin/tin-tuc",         Icon: FileText,    permission: PERMISSIONS.MANAGE_NEWS      },
  { label: "Cộng đồng",       href: "/admin/cong-dong",       Icon: ChatCircle,  permission: PERMISSIONS.MANAGE_COMMUNITY },
  { label: "Hồ sơ học sinh",  href: "/admin/hoc-sinh",        Icon: UsersGroup,  permission: PERMISSIONS.MANAGE_STUDENTS  },
  { label: "Lead tư vấn",     href: "/admin/sales-leads",     Icon: Robot,       permission: PERMISSIONS.VIEW_SALES_LEADS },
  { label: "Doanh thu",       href: "/admin/doanh-thu",        Icon: Wallet,     permission: PERMISSIONS.VIEW_REVENUE    },
  { label: "Quản trị viên",   href: "/admin/quan-tri-vien",    Icon: Edit,       permission: PERMISSIONS.MANAGE_ADMINS   },
];

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  admin_super:   { label: "Cấp 1 - Super Admin",   color: "#FE9900", bg: "rgba(254,153,0,0.15)"  },
  admin_content: { label: "Cấp 2 - Content Admin", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const badge = user?.adminRole ? ROLE_BADGE[user.adminRole] : null;

  const visibleItems = NAV_ITEMS.filter(item =>
    item.permission == null || hasPermission(user, item.permission)
  );

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col min-h-screen" style={{ background: "#1E2938" }}>
      {/* Logo + user info */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
            ME
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-none truncate">Midnight Elite Admin</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user?.name ?? "Admin"}
            </div>
          </div>
        </div>

        {/* Role badge */}
        {badge && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            style={{ background: badge.bg, border: `1px solid ${badge.color}30` }}>
            <span className="text-xs font-bold truncate" style={{ color: badge.color }}>
              {badge.label}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const active     = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          const hasChildren = item.children && item.children.length > 0;
          const childActive = hasChildren && item.children!.some(
            ch => pathname === ch.href || pathname.startsWith(ch.href + "/")
          );
          const isExpanded = active || childActive;

          return (
            <div key={item.href}>
              <Link href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={isExpanded
                  ? { background: "rgba(0,104,255,0.2)", color: "#60A5FA" }
                  : { color: "rgba(255,255,255,0.55)" }
                }>
                <item.Icon
                  size={16}
                  style={{ color: isExpanded ? "#60A5FA" : "rgba(255,255,255,0.45)", flexShrink: 0 }}
                />
                <span className="truncate flex-1">{item.label}</span>
                {hasChildren && (
                  <span className="text-xs opacity-50">{isExpanded ? "▾" : "▸"}</span>
                )}
              </Link>

              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5 pl-3" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                  {item.children!.map(ch => {
                    const chActive = pathname === ch.href || pathname.startsWith(ch.href + "/");
                    return (
                      <Link key={ch.href} href={ch.href}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                        style={chActive
                          ? { color: "#60A5FA", background: "rgba(0,104,255,0.12)" }
                          : { color: "rgba(255,255,255,0.4)" }
                        }>
                        <span className="w-1 h-1 rounded-full flex-shrink-0"
                          style={{ background: chActive ? "#60A5FA" : "rgba(255,255,255,0.25)" }} />
                        {ch.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-5 pt-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-white/5"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          Xem trang web
        </Link>
        <Link href="/student"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all hover:bg-white/5"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          Portal học viên
        </Link>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left hover:bg-red-500/10"
          style={{ color: "#FF4D6D" }}>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
