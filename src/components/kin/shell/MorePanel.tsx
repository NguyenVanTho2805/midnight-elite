// Bảng "Khác" của vỏ KiN: các trang không nằm trên thanh module vẫn có lối vào (học sinh: thi thử, hồ sơ…; gia sư: doanh thu, cài đặt…).
// Điện thoại: nổi ngay trên thanh dưới; máy tính: nổi cạnh thanh module. Đóng bằng Esc, bấm ra ngoài, chọn một mục, hoặc bấm lại nút "Khác".
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { NavGroup } from "./ModuleRail";

/** `icon`: tên biểu tượng của thanh rộng (ShellIcon); bảng "Khác" không vẽ biểu tượng. */
export interface MoreGroup { title: string; links: { label: string; href: string; icon?: string }[] }

/** Cùng các mục của bảng "Khác" nhưng ở dạng NHÓM của thanh rộng (Figma "Điều hướng"). Liên kết có "#neo" không bao giờ được tô là đang chọn (nó cùng đường dẫn với mục cha). */
export const moreToNavGroup = (g: MoreGroup): NavGroup => ({
  title: g.title,
  items: g.links.map(l => ({ key: l.href, label: l.label, href: l.href, icon: l.icon ?? "viec", ...(l.href.includes("#") ? { active: false } : {}) })),
});

export const isUnder = (pathname: string, href: string) => {
  const path = href.split("#")[0];
  return pathname === path || pathname.startsWith(path + "/");
};

export function MorePanel({ id, groups, onClose, user, onLogout }: {
  id: string;
  groups: MoreGroup[];
  onClose: () => void;
  user?: { name: string; email?: string } | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Nút "Khác" tự bật/tắt bảng bằng onClick; bỏ qua nó ở đây kẻo bấm đóng rồi lại mở.
      if (ref.current && !ref.current.contains(t) && !t.closest("[data-khac-nut]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div
      id={id}
      ref={ref}
      role="dialog"
      aria-label="Các mục khác"
      className="fixed z-40 left-3 right-3 bottom-[68px] md:left-[87px] md:right-auto md:bottom-4 md:w-[280px] max-h-[75vh] overflow-y-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-2 shadow-[var(--kin-bong-noi)]"
    >
      {user && (
        <div className="px-3 pt-2 pb-2 border-b border-[var(--kin-vien-nhat)] mb-1">
          <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] truncate">{user.name}</p>
          {user.email && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] truncate">{user.email}</p>}
        </div>
      )}
      {groups.map(g => (
        <div key={g.title} className="py-1">
          <p className="px-3 pt-1 pb-1 text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.09em] text-[var(--kin-chu-mo)]">{g.title}</p>
          {g.links.map(l => (
            <Link key={l.href} href={l.href} onClick={onClose}
              aria-current={isUnder(pathname, l.href) ? "page" : undefined}
              className="flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors"
              style={isUnder(pathname, l.href) ? { background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-diem)" } : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
      ))}
      <div className="pt-1 mt-1 border-t border-[var(--kin-vien-nhat)]">
        <button type="button" onClick={() => { onClose(); onLogout(); }}
          className="w-full flex items-center min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-left text-[length:var(--kin-co-small)] font-medium text-[var(--kin-tt-chu-loi)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
