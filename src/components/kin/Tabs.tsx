// Tab KiN (Figma "Tab" 106:30): chữ 13.3px, tab đang mở chữ đậm + gạch chân 2px màu nhấn,
// tab thường chữ xám + gạch chân trong suốt. Cao 44px (Figma vẽ 40px; brand book đòi chạm tối thiểu 44px
// nên phần dư nằm giữa chữ và gạch chân, nhìn vẫn như bản vẽ).
//
// Hai cách dùng, cùng một dáng:
//   <KinTabs …>      — đổi nội dung trong trang (role=tablist/tab, mũi tên trái/phải, Home/End).
//   KIN_TAB_BOX + <KinTabInner active> — đặt trong <Link aria-current="page"> khi tab là điều hướng giữa các trang
//                                         (AdminShell). Đó là điều hướng, không phải tab → không dùng role=tab.
// Gạch chân TRƯỢT (15/10/2026): chuyển động lấy từ Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039
// (viên trượt di chuyển + đổi bề rộng, 0,5 giây, đường cong lò xo; CSS .kin-tab-ink ở src/app/kin-motion.css). Hình dáng vẫn theo Figma (gạch 2px màu nhấn);
// chỉ khác là MỘT gạch chân đi từ tab này sang tab kia thay vì mỗi tab tự bật/tắt. Vị trí đặt thẳng lên DOM (không qua state) nên không dựng lại cả dải tab.
// Dải tab cuộn ngang (điện thoại) thì tab vừa chọn được kéo về giữa (theo No.048).
"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export const KIN_TAB_BOX = "kin-tab group relative inline-flex flex-col justify-between gap-[10px] min-h-11 pt-3 px-4 whitespace-nowrap text-[length:var(--kin-co-small)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

/** `bar={false}`: không vẽ gạch chân riêng — dùng trong KinTabs, nơi một gạch chân chung trượt giữa các tab. */
export function KinTabInner({ active, children, bar = true }: { active: boolean; children: ReactNode; bar?: boolean }) {
  return (
    <>
      <span className={active ? "font-semibold text-[var(--kin-chu-chinh)]" : "font-normal text-[var(--kin-chu-mo)] group-hover:text-[var(--kin-chu-chinh)]"}>{children}</span>
      <span aria-hidden className="block h-[2px] w-full" style={{ background: bar && active ? "var(--kin-nhan-nen)" : "transparent" }} />
    </>
  );
}

export interface KinTabItem<K extends string = string> { key: K; label: ReactNode }

export interface KinTabsProps<K extends string = string> {
  tabs: readonly KinTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** aria-label của cả dải tab. */
  label: string;
  /** id của từng tab / bảng nội dung, để nối aria-controls / aria-labelledby. */
  tabId?: (key: K) => string;
  panelId?: (key: K) => string;
  /** Kẻ một đường dưới cả dải (mặc định có). */
  ruled?: boolean;
  className?: string;
}

export function KinTabs<K extends string = string>({ tabs, value, onChange, label, tabId, panelId, ruled = true, className = "" }: KinTabsProps<K>) {
  const refs = useRef(new Map<K, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  // Đặt gạch chân dưới tab đang mở (đo thẳng từ DOM, ghi thẳng vào biến CSS).
  const place = useCallback(() => {
    const el = refs.current.get(value), ink = inkRef.current;
    if (!el || !ink) return;
    ink.style.setProperty("--x", `${el.offsetLeft}px`);
    ink.style.setProperty("--y", `${el.offsetTop + el.offsetHeight - 2}px`);
    ink.style.setProperty("--w", `${el.offsetWidth}px`);
    ink.dataset.on = "1";
  }, [value]);
  useLayoutEffect(() => { place(); }, [place, tabs]);
  // Chỉ bật chuyển động SAU khung hình đầu — nếu không, gạch chân sẽ trượt từ mép trái vào lần hiện đầu tiên.
  useEffect(() => {
    const id = requestAnimationFrame(() => { if (inkRef.current) inkRef.current.dataset.anim = "1"; });
    return () => cancelAnimationFrame(id);
  }, []);
  // Chữ đổi bề rộng (nạp phông, xoay màn hình, đổi cỡ cửa sổ) thì đặt lại.
  useEffect(() => {
    const box = listRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(box);
    refs.current.forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [place, tabs]);
  // Dải tab dài hơn màn hình: kéo tab vừa chọn về giữa (không động tới cuộn của cả trang). Lần vẽ đầu giữ nguyên vị trí cuộn.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const box = listRef.current, el = refs.current.get(value);
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(t => t.key === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const k = tabs[next].key;
    onChange(k);
    refs.current.get(k)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`kin-m relative flex gap-2 overflow-x-auto ${ruled ? "border-b border-[var(--kin-vien-thuong)]" : ""} ${className}`}
    >
      <span ref={inkRef} aria-hidden className="kin-tab-ink" />
      {tabs.map(t => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            ref={el => { if (el) refs.current.set(t.key, el); else refs.current.delete(t.key); }}
            type="button"
            role="tab"
            id={tabId?.(t.key)}
            aria-selected={active}
            aria-controls={panelId?.(t.key)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={`${KIN_TAB_BOX} ${ruled ? "-mb-px" : ""} cursor-pointer`}
          >
            <KinTabInner active={active} bar={false}>{t.label}</KinTabInner>
          </button>
        );
      })}
    </div>
  );
}
