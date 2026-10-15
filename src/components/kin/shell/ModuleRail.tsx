// Thanh module của vỏ KiN (Figma "Thanh module" 11:99 / Nút module 8:122; bo-cuc-outlook.md mục 3, 6, 8).
// Máy tính: cột trái 79px, dọc, THU ĐƯỢC (14/10/2026: nút "Thu gọn thanh bên" + phím "[", nhớ theo máy và theo tài khoản; xem railStore.ts và
// docs/kin/thiet-ke/thanh-ben-trai.md). Điện thoại: thanh dưới cao 60px (ngón cái với tới đáy), luôn hiện, không thu.
// Nút đang chọn dùng aria-current, KHÔNG dùng aria-selected (đây là điều hướng, không phải chọn trong một tập).
// Badge đỏ chỉ đếm VIỆC CẦN NGƯỜI ĐÓ RA TAY và có nhãn chữ đọc được ("3 việc cần xử lý").
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ShellIcon } from "./ShellIcon";
import { chooseRail, readRail, useRail } from "./railStore";
import { isRailShortcut, toggleRail } from "@/lib/railState";

export interface ModuleItem {
  key: string;
  label: string;
  href?: string;
  /** Đường dẫn khác cũng coi là đang ở module này (vd. /student/bai-giang thuộc "Lớp"). */
  also?: string[];
  icon: string;
  /** Số việc cần ra tay. 0 / undefined = không hiện. */
  badge?: number;
  /** Mở thẻ <a> thường (sang tên miền khác). */
  external?: boolean;
  /** Không phải liên kết mà là nút (vd. "Khác" mở bảng). */
  onClick?: () => void;
  active?: boolean;
  controls?: string;
  expanded?: boolean;
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
export const isModuleActive = (pathname: string, m: ModuleItem) =>
  m.active ?? (!!m.href && (matches(pathname, m.href) || (m.also ?? []).some(p => matches(pathname, p))));

function Badge({ n, mobile }: { n: number; mobile: boolean }) {
  return (
    <span className={`kin-badge-dem absolute top-[3px] ${mobile ? "left-[calc(50%+4px)]" : "left-[40px]"}`} aria-label={`${n} việc cần xử lý`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function ModuleRail({ roleLabel, modules, ariaLabel, children, onCollapse }: {
  roleLabel: string;
  modules: ModuleItem[];
  ariaLabel: string;
  /** Hiện dưới cùng thanh module trên máy tính (vd. nút cài đặt). */
  children?: ReactNode;
  /** Gọi khi người dùng thu thanh (vd. để đóng bảng "Khác" đang neo vào thanh). */
  onCollapse?: () => void;
}) {
  const pathname = usePathname();
  const [rail] = useRail();

  // Thu: tiêu điểm sang nút "Mở thanh bên" ở dải trên. (Thanh bị ẩn nên nút bấm vừa rồi mất tiêu điểm; không chuyển thì bàn phím rơi về đầu trang.)
  const collapse = () => {
    chooseRail("thu");
    onCollapse?.();
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-rail-open]")?.focus());
  };

  // Phím "[" bật/tắt, chỉ ở máy tính và khi không đang gõ chữ. Đăng ký ở đây (mỗi vỏ có đúng một thanh) nên phòng thi — không có vỏ — cũng không bắt phím này.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      const t = e.target as HTMLElement | null;
      if (!isRailShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: e.isComposing, repeat: e.repeat, target: t && { tagName: t.tagName, isContentEditable: t.isContentEditable, role: t.getAttribute?.("role") } })) return;
      e.preventDefault();
      const next = toggleRail(readRail());
      if (next === "thu") { chooseRail("thu"); onCollapse?.(); } else chooseRail("mo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCollapse]);

  const renderItem = (m: ModuleItem, mobile: boolean) => {
    const active = isModuleActive(pathname, m);
    const cls = mobile
      ? "relative flex-1 min-w-0 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[length:var(--kin-co-caption)] tracking-[0.02em]"
      : "relative w-[66px] min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-[var(--kin-bo-sm)] pt-2 pb-[6px] px-0 text-[length:var(--kin-co-caption)] tracking-[0.01em]";
    const style = {
      background: active ? "var(--kin-nen-nhan)" : "transparent",
      color: active ? "var(--kin-th-navy)" : "var(--kin-chu-mo)",
      fontWeight: 600,
    } as const;
    const inner = (
      <>
        <ShellIcon name={m.icon} />
        <span className="truncate max-w-full leading-tight">{m.label}</span>
        {m.badge && m.badge > 0 ? <Badge n={m.badge} mobile={mobile} /> : null}
      </>
    );
    const common = { className: `${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`, style, "aria-current": active ? ("page" as const) : undefined };
    if (m.onClick) {
      return <button key={m.key} type="button" onClick={m.onClick} data-khac-nut aria-haspopup="dialog" aria-expanded={m.expanded ?? false} aria-controls={m.controls} {...common}>{inner}</button>;
    }
    return m.external || !m.href?.startsWith("/")
      ? <a key={m.key} href={m.href} {...common}>{inner}</a>
      : <Link key={m.key} href={m.href} {...common}>{inner}</Link>;
  };

  return (
    <>
      {/* Máy tính. Khung ngoài đổi bề rộng 79px ⇄ 0 (CSS .kin-rail-wrap ở kin-tokens.css, theo data-kin-rail trên <html>); thanh bên trong giữ nguyên 79px. */}
      <div id="kin-rail" className="kin-rail-wrap hidden md:block flex-shrink-0">
        <nav aria-label={ariaLabel}
          className="flex flex-col items-center gap-[2px] w-[79px] px-[6px] py-[10px] sticky top-0 h-screen overflow-y-auto bg-[var(--kin-nen-bang)] border-r border-[var(--kin-vien-thuong)]">
          <button type="button" data-rail-close onClick={collapse}
            aria-label="Thu gọn thanh bên" aria-expanded={rail === "mo"} aria-controls="kin-rail" title="Thu gọn thanh bên (phím [)"
            className="self-center w-[66px] min-h-11 mb-1 flex items-center justify-center rounded-[var(--kin-bo-sm)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] hover:text-[var(--kin-chu-chinh)] transition-colors">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /><path d="M16 10l-2 2 2 2" />
            </svg>
          </button>
          <p className="text-[length:var(--kin-co-caption)] font-semibold tracking-[0.02em] text-[var(--kin-chu-mo)] text-center mb-[10px]">{roleLabel}</p>
          {modules.map(m => renderItem(m, false))}
          {children && <div className="mt-auto pt-3 flex flex-col items-center gap-1">{children}</div>}
        </nav>
      </div>
      <nav aria-label={ariaLabel}
        className="md:hidden fixed bottom-0 inset-x-0 h-[60px] flex z-30 bg-[var(--kin-nen-bang)] border-t border-[var(--kin-vien-thuong)]">
        {modules.map(m => renderItem(m, true))}
      </nav>
    </>
  );
}
