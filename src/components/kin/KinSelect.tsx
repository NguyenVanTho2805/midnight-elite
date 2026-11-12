// LOI-02 (11/11/2026) — ô chọn KiN thay <select> gốc của trình duyệt (lệch giao diện, khó bấm ở 390). Đặc tả: docs/kin/phong-ban/dac-ta/LOI-02.md mục 2.G + 4.4.
// API gần <select>: value / onChange(value) / options; `name` ⇒ thêm <input type=hidden> để gửi form. Nút role="combobox" + danh sách role="listbox", mục role="option".
// Bàn phím — đóng: ↓ ↑ Enter Space mở (tô mục đang chọn), gõ chữ chọn mục đầu khớp (so không dấu, như <select>); mở: ↑ ↓ Home End đi, Enter chọn + đóng,
// Esc đóng + trả tiêu điểm về nút, Tab đóng. Bấm ngoài đóng. > 8 lựa chọn ⇒ ô tìm ở đầu (lọc không dấu, chứa chuỗi). Nút và mỗi mục cao ≥ 44px; danh sách rộng bằng nút,
// max-height min(320px, 50vh), không rộng quá khung nhìn (390 không tràn). Chỉ token --kin-*, không mã hex. Không xuất qua kin/index.ts (import thẳng tệp này).
// Tên đọc được của nút = nhãn + giá trị đang chọn: aria-labelledby="<id nhãn> <id span giá trị>" (chỉ có aria-label ⇒ span ẩn giữ nhãn) — trình đọc màn hình
// đọc "Lớp, Tất cả lớp" thay vì chỉ "Lớp". Dùng <label htmlFor={id}> riêng thì sau khi chạy JS cũng nối nhãn đó + giá trị.
//
// LOI-06 (11/11/2026) — thay <select> gốc ở mọi vai. Thêm, giữ tương thích ngược:
// - `children` là <option>/<optgroup> như <select> (đọc thành `options`; dùng một trong hai), `group` trên lựa chọn = <optgroup> (role="group" có nhãn).
// - `defaultValue` (không điều khiển, như <select defaultValue>) — `value` vẫn được ưu tiên khi có.
// - `name` ⇒ input ẩn mang giá trị cho biểu mẫu POST + 303; `disabled` ⇒ input ẩn cũng tắt (như <select disabled> không gửi giá trị).
// - `required` ⇒ aria-required + ô kiểm hợp lệ ẩn trong form: gửi khi chưa chọn thì trình duyệt chặn, ô hiện CHỮ "Hãy chọn một mục trong danh sách." và tiêu điểm về nút.
// - `onBlur` chỉ chạy khi tiêu điểm rời HẲN ô chọn (không chạy khi chuyển từ nút sang ô tìm); `aria-describedby` / `aria-invalid` / `data-*` / `title` / `autoFocus` gắn lên nút.
// - `data-value` trên nút (giá trị đang chọn) và trên từng mục — để bài thử chọn / đọc theo giá trị như selectOption() / inputValue() (tools/local-e2e/ui.ts: kinPick, kinSelectValue).
// - Danh sách mở dùng position: fixed theo toạ độ nút ⇒ không bị khung cuộn (panel bên, hộp thoại, bảng overflow) cắt; thiếu chỗ phía dưới thì mở lên trên;
//   cuộn / đổi cỡ khung nhìn thì bám theo nút. Tổ tiên có transform (ngăn kéo trượt) được bù toạ độ.
// - Bọc trong <label> vẫn chạy: bấm mục không bị nhãn biến thành cú bấm lại vào nút; sau khi chạy JS tên đọc = chữ của nhãn (trừ phần ô) + giá trị.
"use client";
import {
  Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type FocusEvent, type KeyboardEvent, type ReactNode,
} from "react";

export interface KinSelectOption { value: string; label: string; disabled?: boolean; /** Tên nhóm (như <optgroup label>). Các lựa chọn cùng nhóm nên đứng liền nhau. */ group?: string }
export interface KinSelectProps {
  /** Giá trị đang chọn (có điều khiển). Bỏ trống + `defaultValue` ⇒ ô tự giữ giá trị. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options?: KinSelectOption[];
  /** <option>/<optgroup> như trong <select> — dùng khi không truyền `options`. */
  children?: ReactNode;
  /** Có ⇒ <input type="hidden" name={name} value={value}> để gửi form. */
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  title?: string;
  /** Chữ hiện khi `value` không khớp lựa chọn nào. */
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  className?: string;
  [data: `data-${string}`]: string | number | boolean | undefined;
}

/** Ngưỡng hiện ô tìm. */
export const KIN_SELECT_SEARCH_MIN = 9;
/** Chữ báo khi ô bắt buộc chưa chọn mà gửi form. */
export const KIN_SELECT_REQUIRED_MSG = "Hãy chọn một mục trong danh sách.";

/** Bỏ dấu tiếng Việt + chữ thường (đ → d) để so khớp. */
export const kinFold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

function textOf(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
}

/** Đọc <option>/<optgroup> (kể cả trong mảng, Fragment) thành danh sách lựa chọn — như trình duyệt đọc con của <select>. */
export function kinOptionsFromChildren(children: ReactNode, group?: string): KinSelectOption[] {
  const out: KinSelectOption[] = [];
  Children.forEach(children, ch => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean; label?: string }>(ch)) return;
    if (ch.type === Fragment) { out.push(...kinOptionsFromChildren(ch.props.children, group)); return; }
    if (ch.type === "optgroup") { out.push(...kinOptionsFromChildren(ch.props.children, ch.props.label ?? "").map(o => ({ ...o, disabled: o.disabled || ch.props.disabled || undefined }))); return; }
    if (ch.type === "option") {
      const label = textOf(ch.props.children).replace(/\s+/g, " ").trim() || (ch.props.label ?? "");
      const value = ch.props.value !== undefined ? String(ch.props.value) : label;
      out.push({ value, label, ...(ch.props.disabled ? { disabled: true } : {}), ...(group !== undefined ? { group } : {}) });
    }
  });
  return out;
}

/** Phần tử làm khối chứa cho position: fixed (transform / filter / perspective / contain / will-change) — null = khung nhìn. */
function fixedContainer(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p && p !== document.documentElement; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.transform !== "none" || s.perspective !== "none" || (s.filter && s.filter !== "none") || /paint|layout|strict|content/.test(s.contain || "")
      || /transform|perspective|filter/.test(s.willChange || "") || ((s as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter ?? "none") !== "none") return p;
  }
  return null;
}

interface Place { top: number; left: number; width: number; maxH: number; up: boolean }

export function KinSelect({
  value: valueProp, defaultValue, onChange, options: optionsProp, children, name, id, disabled, required, autoFocus, title,
  placeholder = "Chọn…", className = "", onBlur, ...rest
}: KinSelectProps) {
  const auto = useId();
  const baseId = id ?? `kin-select-${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const listId = `${baseId}-list`;
  const valueId = `${baseId}-value`;
  const labelId = `${baseId}-label`;
  const errId = `${baseId}-err`;
  const ariaLabel = rest["aria-label"], ariaLabelledby = rest["aria-labelledby"];
  const dataAttrs = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("data-")));
  const options = useMemo(() => optionsProp ?? kinOptionsFromChildren(children), [optionsProp, children]);
  const [inner, setInner] = useState(defaultValue ?? options.find(o => !o.disabled)?.value ?? "");
  const value = valueProp ?? inner;
  // <label htmlFor={id}> riêng (không bọc ô): sau khi chạy JS nối nhãn đó + giá trị như aria-labelledby.
  const [forLabel, setForLabel] = useState<string | undefined>(undefined);
  // <label> bọc ô: chữ của nhãn (trừ phần ô chọn) ⇒ span ẩn, để tên đọc = nhãn + giá trị, không lẫn chữ của danh sách đang mở.
  const [wrapLabel, setWrapLabel] = useState<string | undefined>(undefined);
  const labelText = ariaLabel ?? wrapLabel;
  // Nhãn của nút (cũng là nhãn của danh sách): id nhãn bên ngoài, hoặc span ẩn mang aria-label / chữ của nhãn bọc, hoặc <label htmlFor>.
  const nameId = ariaLabelledby ?? (labelText ? labelId : forLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // chỉ số trong `shown`
  const [query, setQuery] = useState("");
  const [missing, setMissing] = useState(false); // required + gửi form khi chưa chọn
  const [place, setPlace] = useState<Place | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ buf: "", at: 0 });

  const searchable = options.length >= KIN_SELECT_SEARCH_MIN;
  const shown = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = kinFold(query.trim());
    return options.filter(o => kinFold(o.label).includes(q) || (o.group !== undefined && kinFold(o.group).includes(q)));
  }, [options, query, searchable]);
  const selected = options.find(o => o.value === value) ?? null;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const firstEnabled = useCallback((list: KinSelectOption[], from = 0, dir: 1 | -1 = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += dir) if (!list[i].disabled) return i;
    return -1;
  }, []);

  function commit(v: string) {
    if (valueProp === undefined) setInner(v);
    if (missing && v !== "") setMissing(false);
    onChange?.(v);
  }
  function openList() {
    if (disabled) return;
    setQuery("");
    const cur = options.findIndex(o => o.value === value && !o.disabled);
    setActive(cur >= 0 ? cur : firstEnabled(options));
    setOpen(true);
  }
  function close(focusButton: boolean) {
    setOpen(false); setQuery(""); setPlace(null);
    if (focusButton) btn.current?.focus();
  }
  function choose(i: number) {
    const o = shown[i];
    if (!o || o.disabled) return;
    if (o.value !== value) commit(o.value);
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
  /** Gõ chữ (`now` = e.timeStamp của phím): gom các phím gõ nhanh (< 600ms) thành một chuỗi, tìm mục đầu tiên có nhãn bắt đầu bằng chuỗi đó (không dấu). */
  function typeahead(ch: string, now: number): number {
    typed.current = { buf: now - typed.current.at < 600 ? typed.current.buf + ch : ch, at: now };
    const q = kinFold(typed.current.buf);
    return options.findIndex(o => !o.disabled && kinFold(o.label).startsWith(q));
  }

  // <label htmlFor={id}> riêng ⇒ lấy id nhãn (gán id nếu nhãn chưa có) để tên đọc = nhãn + giá trị. Nhãn bọc ô thì bỏ qua (chữ của nó đã gồm cả ô).
  useEffect(() => {
    if (ariaLabelledby || ariaLabel) return;
    const l = btn.current?.labels?.[0];
    if (!l) return;
    if (l.contains(btn.current)) {
      // Nhãn bọc ô: lấy chữ của nhãn, bỏ phần nằm trong ô chọn này.
      const walk = (n: Node): string => n === wrap.current ? "" : n.nodeType === Node.TEXT_NODE ? (n.textContent ?? "")
        : n instanceof HTMLElement && (n.hidden || n.getAttribute("aria-hidden") === "true") ? "" : [...n.childNodes].map(walk).join(" ");
      const t = walk(l).replace(/\s+/g, " ").trim();
      if (t) setWrapLabel(t);
      return;
    }
    if (!l.id) l.id = `${baseId}-for`;
    setForLabel(l.id);
  }, [baseId, ariaLabelledby, ariaLabel]);
  // Mở có ô tìm: đưa tiêu điểm vào ô tìm. Không có ô tìm: tiêu điểm ở lại nút (aria-activedescendant chỉ mục đang tô).
  // Đợi danh sách có vị trí (lần vẽ đầu ẩn để đo) rồi mới đưa tiêu điểm — phần tử visibility:hidden không nhận tiêu điểm.
  const placed = place !== null;
  useEffect(() => { if (open && searchable && placed) search.current?.focus(); }, [open, searchable, placed]);
  // Lọc đổi ⇒ tô mục đầu còn chọn được.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && searchable) setActive(firstEnabled(shown)); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mục đang tô luôn nằm trong khung cuộn (chỉ cuộn danh sách, không kéo trang).
  useEffect(() => {
    if (!open || active < 0) return;
    const ul = list.current, el = ul?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`);
    if (!ul || !el) return;
    const r = el.getBoundingClientRect(), b = ul.getBoundingClientRect();
    if (r.top < b.top) ul.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) ul.scrollTop += r.bottom - b.bottom;
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bấm ngoài ⇒ đóng (không kéo tiêu điểm về).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) close(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
  }, [open]);
  // Vị trí danh sách (position: fixed theo nút): không bị khung cuộn cắt; thiếu chỗ dưới thì mở lên; bám theo khi cuộn / đổi cỡ.
  useLayoutEffect(() => {
    if (!open) return;
    const cb = fixedContainer(wrap.current);
    const calc = () => {
      const b = btn.current?.getBoundingClientRect();
      if (!b) return;
      const vv = window.visualViewport;
      const vw = document.documentElement.clientWidth || window.innerWidth, vh = vv?.height ?? window.innerHeight;
      const cap = Math.min(320, vh / 2);
      const below = vh - b.bottom - 8, above = b.top - 8;
      const up = below < Math.min(cap, 180) && above > below;
      const maxH = Math.max(96, Math.min(cap, up ? above : below));
      const width = Math.min(Math.max(b.width, 160), vw - 32);
      const left = Math.max(16, Math.min(b.left, vw - 16 - width));
      let top = up ? b.top - 4 : b.bottom + 4, lft = left;
      if (cb) { const c = cb.getBoundingClientRect(); top -= c.top + cb.clientTop - cb.scrollTop; lft -= c.left + cb.clientLeft - cb.scrollLeft; }
      setPlace(p => (p && p.top === top && p.left === lft && p.width === width && p.maxH === maxH && p.up === up ? p : { top, left: lft, width, maxH, up }));
    };
    calc();
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(calc); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); window.visualViewport?.removeEventListener("resize", onMove); };
  }, [open]);

  function onKey(e: KeyboardEvent<HTMLElement>, fromSearch: boolean) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openList(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = typeahead(e.key, e.timeStamp);
        if (i >= 0) { e.preventDefault(); if (options[i].value !== value) commit(options[i].value); }
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
          const i = typeahead(e.key, e.timeStamp);
          if (i >= 0) { e.preventDefault(); setActive(shown.indexOf(options[i])); }
        }
    }
  }

  const activeId = open && active >= 0 && shown[active] ? optId(active) : undefined;
  const invalid = missing || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
  const describedBy = [rest["aria-describedby"], missing ? errId : undefined].filter(Boolean).join(" ") || undefined;

  // Lựa chọn liền nhau cùng `group` gom thành một khối role="group" (như <optgroup>); chỉ số `i` vẫn là chỉ số phẳng trong `shown`.
  const blocks: { group?: string; items: { o: KinSelectOption; i: number }[] }[] = [];
  shown.forEach((o, i) => {
    const last = blocks[blocks.length - 1];
    if (last && last.group === o.group) last.items.push({ o, i }); else blocks.push({ group: o.group, items: [{ o, i }] });
  });
  const optionLi = ({ o, i }: { o: KinSelectOption; i: number }) => {
    const on = o.value === value;
    return (
      <li key={`${o.value}-${i}`} id={optId(i)} role="option" aria-selected={on} aria-disabled={o.disabled || undefined} data-value={o.value}
        onMouseEnter={() => { if (!o.disabled) setActive(i); }}
        onMouseDown={e => e.preventDefault() /* giữ tiêu điểm ở nút / ô tìm */}
        onClick={e => { e.preventDefault() /* nằm trong <label>: không để nhãn bấm lại vào nút */; choose(i); }}
        className={`flex min-h-[var(--kin-cham-toi-thieu)] cursor-pointer items-center gap-2 px-3 text-[length:var(--kin-co-goc)] leading-5 break-words ${
          i === active ? "bg-[var(--kin-nen-re-chuot)]" : ""} ${on ? "font-medium text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-chinh)]"} ${o.disabled ? "cursor-not-allowed opacity-45" : ""}`}>
        <span aria-hidden className="w-4 flex-shrink-0 text-[var(--kin-nhan-link)]">{on ? "✓" : ""}</span>
        <span className="min-w-0 flex-1">{o.label}</span>
      </li>
    );
  };

  return (
    <div ref={wrap} data-kin-select className={`relative min-w-0 ${className}`}
      onBlur={onBlur ? e => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) onBlur(e); } : undefined}>
      {name !== undefined && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {labelText && !ariaLabelledby && <span id={labelId} hidden>{labelText}</span>}
      <button ref={btn} type="button" id={baseId} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={searchable ? undefined : activeId} aria-labelledby={nameId ? `${nameId} ${valueId}` : undefined}
        aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        disabled={disabled} autoFocus={autoFocus} title={title} data-kin-select-nut data-value={value} {...dataAttrs}
        onClick={() => (open ? close(false) : openList())} onKeyDown={e => onKey(e, false)}
        className={`flex w-full min-h-[var(--kin-cham-toi-thieu)] items-center justify-between gap-2 rounded-[var(--kin-bo-md)] border bg-[var(--kin-nen-trang)] px-3 text-left text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--kin-nhan-link)] disabled:cursor-not-allowed disabled:opacity-45 ${
          invalid ? "border-[var(--kin-tt-chu-loi)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
        <span id={valueId} className={`min-w-0 flex-1 truncate ${selected ? "" : "text-[var(--kin-chu-mo)]"}`}>{selected ? selected.label : placeholder}</span>
        <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {required && (
        // Ô kiểm hợp lệ: input ẩn (type=hidden) không được trình duyệt kiểm `required`, nên dùng ô chữ vô hình, không nhận tiêu điểm, không tên (không gửi đi).
        <input tabIndex={-1} aria-hidden required value={value} disabled={disabled} onChange={() => {}} data-kin-select-kiem
          onInvalid={e => { e.preventDefault(); setMissing(true); btn.current?.focus(); }}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0" />
      )}
      {missing && <p id={errId} className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-tt-chu-loi)]">{KIN_SELECT_REQUIRED_MSG}</p>}
      {open && (
        <div data-kin-select-mo onClick={e => e.preventDefault() /* nằm trong <label> */}
          className="fixed z-[60] flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-noi)]"
          style={place
            ? { top: place.top, left: place.left, width: place.width, maxHeight: place.maxH, transform: place.up ? "translateY(-100%)" : undefined }
            : { visibility: "hidden", maxHeight: "min(320px, 50vh)" }}>
          {searchable && (
            <div className="flex-shrink-0 border-b border-[var(--kin-vien-nhat)] p-2">
              <input ref={search} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => onKey(e, true)}
                role="searchbox" aria-label="Tìm lựa chọn" aria-controls={listId} aria-activedescendant={activeId} placeholder="Tìm…" autoComplete="off"
                className="w-full min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]" />
            </div>
          )}
          <ul ref={list} id={listId} role="listbox" aria-labelledby={nameId ?? baseId}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {blocks.map((bk, bi) => bk.group === undefined ? bk.items.map(optionLi) : (
              <li key={`g-${bi}`} role="group" aria-labelledby={`${baseId}-g-${bi}`}>
                <span id={`${baseId}-g-${bi}`} className="block px-3 pt-2 pb-1 text-[length:var(--kin-co-goc)] font-medium leading-5 text-[var(--kin-chu-phu)]">{bk.group}</span>
                <ul role="none">{bk.items.map(optionLi)}</ul>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p role="status" className="px-3 py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Không có lựa chọn khớp</p>}
        </div>
      )}
    </div>
  );
}

export default KinSelect;
