"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBar, BookOpen, ClipboardList, Badge,
  UsersGroup, Wallet, Edit, FileText, ChatCircle, Star, UserCheck,
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
  { label: "Tổng quan",      href: "/admin",               Icon: ChartBar     },
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
      { label: "Danh sách đề thi",  href: "/admin/thi-thu" },
      { label: "Ngân hàng câu hỏi", href: "/admin/thi-thu/ngan-hang-cau-hoi" },
      { label: "Ngân hàng đề thi",  href: "/admin/thi-thu/ngan-hang-de-thi" },
    ],
  },
  { label: "Đánh giá khóa học", href: "/admin/danh-gia",      Icon: Star,       permission: PERMISSIONS.MANAGE_COURSES   },
  { label: "Bảng vinh danh",  href: "/admin/vinh-danh",       Icon: Badge,      permission: PERMISSIONS.MANAGE_HONOR    },
  { label: "Tin tức & Blog",  href: "/admin/tin-tuc",         Icon: FileText,    permission: PERMISSIONS.MANAGE_NEWS      },
  {
    label:      "Cộng đồng",
    href:       "/admin/cong-dong",
    Icon:       ChatCircle,
    permission: PERMISSIONS.MANAGE_COMMUNITY,
    children: [
      { label: "Bài viết",          href: "/admin/cong-dong" },
      { label: "Báo cáo trả lời",   href: "/admin/cong-dong/bao-cao" },
    ],
  },
  { label: "Hồ sơ học sinh",  href: "/admin/hoc-sinh",        Icon: UsersGroup,  permission: PERMISSIONS.MANAGE_STUDENTS  },
  { label: "Duyệt gia sư",    href: "/admin/ho-so-gia-su",    Icon: UserCheck,   permission: PERMISSIONS.MANAGE_TUTORS    },
  { label: "Doanh thu",       href: "/admin/doanh-thu",        Icon: Wallet,     permission: PERMISSIONS.VIEW_REVENUE    },
  { label: "Quản trị viên",   href: "/admin/quan-tri-vien",    Icon: Edit,       permission: PERMISSIONS.MANAGE_ADMINS   },
];

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  admin_super:   { label: "Cấp 1 - Super Admin",   color: "#FE9900", bg: "rgba(254,153,0,0.15)"  },
  admin_content: { label: "Cấp 2 - Content Admin", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  teacher:       { label: "Giáo viên",             color: "#16a34a", bg: "rgba(22,163,74,0.12)"  },
};

// open/onClose: dưới breakpoint lg sidebar là ngăn kéo (off-canvas) mở bằng nút
// menu ở AdminTopbar; từ lg trở lên luôn hiện cố định như cũ. Trước đây sidebar
// luôn rộng 256px nên trên điện thoại cột nội dung chỉ còn ~130px.
export default function AdminSidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const badge = user?.adminRole ? ROLE_BADGE[user.adminRole] : null;

  const visibleItems = NAV_ITEMS.filter(item =>
    item.permission == null || hasPermission(user, item.permission)
  );

  return (
    <>
    {open && <div className="lg:hidden fixed inset-0 z-40" style={{ background: "rgba(15,23,42,0.55)" }} onClick={onClose} aria-hidden="true" />}
    <aside id="admin-sidebar" aria-label="Menu quản trị"
      className={`w-64 flex-shrink-0 flex flex-col h-screen fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      style={{ background: "#1E2938" }}>
      {/* Logo + user info */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
            ME
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-bold text-sm leading-none truncate">Midnight Elite Admin</div>
            <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user?.name ?? "Admin"}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng menu"
            className="lg:hidden w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-xl cursor-pointer"
            style={{ color: "rgba(255,255,255,0.7)" }}>✕</button>
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
      <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const active     = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          const hasChildren = item.children && item.children.length > 0;
          const childActive = hasChildren && item.children!.some(ch =>
            pathname === ch.href || (
              pathname.startsWith(ch.href + "/") &&
              !item.children!.some(s => s.href !== ch.href && pathname.startsWith(s.href))
            )
          );
          const isExpanded = active || childActive;

          return (
            <div key={item.href}>
              <Link href={item.href} onClick={onClose}
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
                    const chActive = pathname === ch.href || (
                      pathname.startsWith(ch.href + "/") &&
                      !item.children!.some(s => s.href !== ch.href && pathname.startsWith(s.href))
                    );
                    return (
                      <Link key={ch.href} href={ch.href} onClick={onClose}
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
        {/* "Xem trang web" và "Portal học viên" đã có ở góc phải trên
            (AdminTopbar, (admin)/layout.tsx) — bỏ bản trùng ở đây. */}
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left hover:bg-red-500/10"
          style={{ color: "#FF4D6D" }}>
          Đăng xuất
        </button>
      </div>
    </aside>
    </>
  );
}
