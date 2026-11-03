// Panel bên dùng chung của các bảng quản trị (CAT-02; BU-08 dùng lại cho Việc chờ, Gia sư…).
// Không phải hộp thoại: ở ≥1280px nó đứng cạnh bảng (trang tự chừa lề phải PANEL_GUTTER), nền KHÔNG khoá — vẫn bấm được hàng khác.
// Dưới 1280px nó chồng lên có nền mờ (chạm nền để đóng); dưới 768px là tấm toàn màn hình.
// Đóng: Esc · nút ✕ · chạm nền. Mở thì tiêu điểm vào panel, đóng thì trả về phần tử đã mở nó. Bẫy tiêu điểm chỉ khi có nền mờ (<1280px).
"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";

/** Lề phải mà trang phải chừa khi panel mở ở ≥1280px (đúng bằng bề rộng panel). */
export const PANEL_GUTTER = "xl:pr-[420px]";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SidePanel({ open, onClose, title, subtitle, children, footer, label }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Chân dính (nút Lưu · Huỷ). */
  footer?: ReactNode;
  /** Tên truy cập khi tiêu đề không phải chuỗi. */
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const prev = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    const t = setTimeout(() => ref.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      const p = prev.current;
      if (p instanceof HTMLElement && document.contains(p)) p.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      if (window.matchMedia("(min-width: 1280px)").matches) return; // ≥1280: nền không khoá, không bẫy
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div aria-hidden data-side-panel-scrim onClick={onClose} className="xl:hidden fixed inset-0 z-40 bg-[var(--kin-chu-chinh)]/40" />
      <aside
        ref={ref}
        tabIndex={-1}
        data-side-panel
        aria-labelledby={label ? undefined : titleId}
        aria-label={label}
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full md:w-[420px] max-w-full bg-[var(--kin-nen-trang)] border-l border-[var(--kin-vien-thuong)] shadow-[var(--kin-bong-noi)] outline-none"
      >
        <div className="flex items-start gap-3 px-4 md:px-6 pt-5 pb-4 border-b border-[var(--kin-vien-nhat)]">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)] break-words">{title}</h2>
            {subtitle != null && <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)] break-words">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 w-11 h-11 flex-shrink-0 inline-flex items-center justify-center rounded-[var(--kin-bo-md)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
          >✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5">{children}</div>
        {footer && <div className="px-4 md:px-6 py-4 border-t border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">{footer}</div>}
      </aside>
    </>
  );
}
