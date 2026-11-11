// LOI-02 (11/11/2026) — ô chọn KiN thay <select> gốc của trình duyệt (lệch giao diện, khó bấm ở 390). Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.G + 4.4.
// API gần <select>: value / onChange(value) / options; `name` ⇒ thêm <input type=hidden> để gửi form. Nút role="combobox" + danh sách role="listbox", mục role="option".
// Bàn phím — đóng: ↓ ↑ Enter Space mở (tô mục đang chọn), gõ chữ chọn mục đầu khớp (so không dấu, như <select>); mở: ↑ ↓ Home End đi, Enter chọn + đóng,
// Esc đóng + trả tiêu điểm về nút, Tab đóng. Bấm ngoài đóng. > 8 lựa chọn ⇒ ô tìm ở đầu (lọc không dấu, chứa chuỗi). Nút và mỗi mục cao ≥ 44px; danh sách rộng bằng nút,
// max-height min(320px, 50vh), không rộng quá khung nhìn (390 không tràn). Chỉ token --kin-*, không mã hex. Không xuất qua kin/index.ts (import thẳng tệp này).
// Lưu ý dùng: KHÔNG bọc trong <label> (bấm vào mục trong danh sách sẽ bị nhãn chuyển thành cú bấm vào nút ⇒ mở lại); dùng id + <label htmlFor> hoặc aria-labelledby.
"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface KinSelectOption { value: string; label: string; disabled?: boolean }
export interface KinSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: KinSelectOption[];
  /** Có ⇒ <input type="hidden" name={name} value={value}> để gửi form. */
  name?: string;
  id?: string;
  disabled?: boolean;
  /** Chữ hiện khi `value` không khớp lựa chọn nào. */
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Ngưỡng hiện ô tìm. */
export const KIN_SELECT_SEARCH_MIN = 9;

/** Bỏ dấu tiếng Việt + chữ thường (đ → d) để so khớp. */
export const kinFold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

export function KinSelect({ value, onChange, options, name, id, disabled, placeholder = "Chọn…", className = "", ...aria }: KinSelectProps) {
  const auto = useId();
  const baseId = id ?? `kin-select-${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // chỉ số trong `shown`
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ buf: "", at: 0 });

  const searchable = options.length >= KIN_SELECT_SEARCH_MIN;
  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = kinFold(query.trim());
    return options.filter(o => kinFold(o.label).includes(q));
  }, [options, query, searchable]);
  const selected = options.find(o => o.value === value) ?? null;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const firstEnabled = useCallback((list: KinSelectOption[], from = 0, dir: 1 | -1 = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += dir) if (!list[i].disabled) return i;
    return -1;
  }, []);

  function openList() {
    if (disabled) return;
    setQuery("");
    const cur = options.findIndex(o => o.value === value && !o.disabled);
    setActive(cur >= 0 ? cur : firstEnabled(options));
    setOpen(true);
  }
  function close(focusButton: boolean) {
    setOpen(false); setQuery("");
    if (focusButton) btn.current?.focus();
  }
  function choose(i: number) {
    const o = shown[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close(true);
  }
  function step(dir: 1 | -1) {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = i + dir;
      if (i < 0 || i >= shown.length) return; // không vòng: dừng ở đầu / cuối
      if (!shown[i].disabled) { setActive(i); return; }
    }
  }
  /** Gõ chữ: gom các phím gõ nhanh (< 600ms) thành một chuỗi, tìm mục đầu tiên có nhãn bắt đầu bằng chuỗi đó (không dấu). */
  function typeahead(ch: string): number {
    const now = Date.now();
    typed.current = { buf: now - typed.current.at < 600 ? typed.current.buf + ch : ch, at: now };
    const q = kinFold(typed.current.buf);
    return options.findIndex(o => !o.disabled && kinFold(o.label).startsWith(q));
  }

  // Mở có ô tìm: đưa tiêu điểm vào ô tìm. Không có ô tìm: tiêu điểm ở lại nút (aria-activedescendant chỉ mục đang tô).
  useEffect(() => { if (open && searchable) search.current?.focus(); }, [open, searchable]);
  // Lọc đổi ⇒ tô mục đầu còn chọn được.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && searchable) setActive(firstEnabled(shown)); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mục đang tô luôn nằm trong khung cuộn.
  useEffect(() => {
    if (!open || active < 0) return;
    const el = list.current?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bấm ngoài ⇒ đóng (không kéo tiêu điểm về).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) close(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
  }, [open]);

  function onKey(e: KeyboardEvent<HTMLElement>, fromSearch: boolean) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openList(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = typeahead(e.key);
        if (i >= 0) { e.preventDefault(); if (options[i].value !== value) onChange(options[i].value); }
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); step(1); return;
      case "ArrowUp": e.preventDefault(); step(-1); return;
      case "Home": if (!fromSearch) { e.preventDefault(); setActive(firstEnabled(shown)); } return;
      case "End": if (!fromSearch) { e.preventDefault(); setActive(firstEnabled(shown, shown.length - 1, -1)); } return;
      case "Enter": e.preventDefault(); if (active >= 0) choose(active); return;
      case "Escape": e.preventDefault(); e.stopPropagation(); close(true); return;
      case "Tab": close(false); return;
      case " ": if (!fromSearch) { e.preventDefault(); if (active >= 0) choose(active); } return;
      default:
        if (!fromSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = typeahead(e.key);
          if (i >= 0) { e.preventDefault(); setActive(shown.indexOf(options[i])); }
        }
    }
  }

  const activeId = open && active >= 0 && shown[active] ? optId(active) : undefined;

  return (
    <div ref={wrap} data-kin-select className={`relative min-w-0 ${className}`}>
      {name !== undefined && <input type="hidden" name={name} value={value} />}
      <button ref={btn} type="button" id={baseId} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={searchable ? undefined : activeId} aria-label={aria["aria-label"]} aria-labelledby={aria["aria-labelledby"]}
        disabled={disabled} data-kin-select-nut
        onClick={() => (open ? close(false) : openList())} onKeyDown={e => onKey(e, false)}
        className="flex w-full min-h-[var(--kin-cham-toi-thieu)] items-center justify-between gap-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-left text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--kin-nhan-link)] disabled:cursor-not-allowed disabled:opacity-45">
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-[var(--kin-chu-mo)]"}`}>{selected ? selected.label : placeholder}</span>
        <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <div data-kin-select-mo className="absolute left-0 right-0 top-full z-50 mt-1 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-noi)]"
          style={{ maxHeight: "min(320px, 50vh)" }}>
          {searchable && (
            <div className="flex-shrink-0 border-b border-[var(--kin-vien-nhat)] p-2">
              <input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => onKey(e, true)}
                role="searchbox" aria-label="Tìm lựa chọn" aria-controls={listId} aria-activedescendant={activeId} placeholder="Tìm…" autoComplete="off"
                className="w-full min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]" />
            </div>
          )}
          <ul ref={list} id={listId} role="listbox" aria-label={aria["aria-label"]} aria-labelledby={aria["aria-label"] ? undefined : aria["aria-labelledby"] ?? baseId}
            className="min-h-0 flex-1 overflow-y-auto py-1">
            {shown.map((o, i) => {
              const on = o.value === value;
              return (
                <li key={`${o.value}-${i}`} id={optId(i)} role="option" aria-selected={on} aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => { if (!o.disabled) setActive(i); }}
                  onMouseDown={e => e.preventDefault() /* giữ tiêu điểm ở nút / ô tìm */}
                  onClick={() => choose(i)}
                  className={`flex min-h-[var(--kin-cham-toi-thieu)] cursor-pointer items-center gap-2 px-3 text-[length:var(--kin-co-goc)] leading-5 break-words ${
                    i === active ? "bg-[var(--kin-nen-re-chuot)]" : ""} ${on ? "font-medium text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-chinh)]"} ${o.disabled ? "cursor-not-allowed opacity-45" : ""}`}>
                  <span aria-hidden className="w-4 flex-shrink-0 text-[var(--kin-nhan-link)]">{on ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">{o.label}</span>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p role="status" className="px-3 py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không có lựa chọn khớp</p>}
        </div>
      )}
    </div>
  );
}

export default KinSelect;
