// Menu tài khoản ở dải trên của vỏ (14/10/2026): hồ sơ / cài đặt / đăng xuất. Có để KHI THU THANH BÊN vẫn vào được hồ sơ và đăng xuất được
// (trước đó "Khác" — nơi có hai mục này — nằm sau thanh bên). Mẫu menu của WAI-ARIA: nút có aria-haspopup="menu" + aria-expanded; mở thì tiêu điểm vào mục đầu;
// ↑ ↓ Home End di chuyển; Esc đóng và trả tiêu điểm về nút; Tab hoặc bấm ra ngoài đóng. Vùng chạm ≥44px.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface AccountLink { label: string; href: string }

export function AccountMenu({ name, email, initial, links, onLogout }: {
  name: string;
  email?: string;
  initial: string;
  links: AccountLink[];
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = useCallback(() => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []), []);
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => btnRef.current?.focus());
  }, []);

  // Mở → tiêu điểm vào mục đầu.
  useEffect(() => { if (open) requestAnimationFrame(() => items()[0]?.focus()); }, [open, items]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === "Tab") close(false);
  };

  const row = "flex items-center w-full min-h-11 px-3 rounded-[var(--kin-bo-sm)] text-left text-[length:var(--kin-co-small)] font-medium outline-none hover:bg-[var(--kin-nen-re-chuot)] focus-visible:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)] transition-colors";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        data-account-menu
        aria-label={`Tài khoản của ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-center gap-2 min-h-11 min-w-11 pl-1 pr-1 md:pr-3 rounded-full hover:bg-[var(--kin-nen-re-chuot)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
      >
        <span aria-hidden className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[length:var(--kin-co-small)] font-semibold bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)]">{initial}</span>
        <span className="hidden md:block max-w-[160px] truncate text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{name}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label="Tài khoản"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full mt-1 z-50 w-[240px] rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-2 shadow-[var(--kin-bong-noi)]"
        >
          <div className="px-3 pt-2 pb-2 mb-1 border-b border-[var(--kin-vien-nhat)]">
            <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] truncate">{name}</p>
            {email && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] truncate">{email}</p>}
          </div>
          {links.map(l => (
            <Link key={l.href} href={l.href} role="menuitem" tabIndex={-1} onClick={() => close(false)} className={`${row} text-[var(--kin-chu-phu)]`}>{l.label}</Link>
          ))}
          <div className="pt-1 mt-1 border-t border-[var(--kin-vien-nhat)]">
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => { close(false); onLogout(); }} className={`${row} text-[var(--kin-tt-chu-loi)]`}>Đăng xuất</button>
          </div>
        </div>
      )}
    </div>
  );
}
