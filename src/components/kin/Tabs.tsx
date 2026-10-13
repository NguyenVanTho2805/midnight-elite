// Tab KiN (Figma "Tab" 106:30): chữ 13.3px, tab đang mở chữ đậm + gạch chân 2px màu nhấn,
// tab thường chữ xám + gạch chân trong suốt. Cao 44px (Figma vẽ 40px; brand book đòi chạm tối thiểu 44px
// nên phần dư nằm giữa chữ và gạch chân, nhìn vẫn như bản vẽ).
//
// Hai cách dùng, cùng một dáng:
//   <KinTabs …>      — đổi nội dung trong trang (role=tablist/tab, mũi tên trái/phải, Home/End).
//   KIN_TAB_BOX + <KinTabInner active> — đặt trong <Link aria-current="page"> khi tab là điều hướng giữa các trang
//                                         (AdminShell). Đó là điều hướng, không phải tab → không dùng role=tab.
"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export const KIN_TAB_BOX = "kin-tab group relative inline-flex flex-col justify-between gap-[10px] min-h-11 pt-3 px-4 whitespace-nowrap text-[length:var(--kin-co-small)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

export function KinTabInner({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <>
      <span className={active ? "font-semibold text-[var(--kin-chu-chinh)]" : "font-normal text-[var(--kin-chu-mo)] group-hover:text-[var(--kin-chu-chinh)]"}>{children}</span>
      <span aria-hidden className="block h-[2px] w-full" style={{ background: active ? "var(--kin-nhan-nen)" : "transparent" }} />
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
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex gap-2 overflow-x-auto ${ruled ? "border-b border-[var(--kin-vien-thuong)]" : ""} ${className}`}
    >
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
            <KinTabInner active={active}>{t.label}</KinTabInner>
          </button>
        );
      })}
    </div>
  );
}
