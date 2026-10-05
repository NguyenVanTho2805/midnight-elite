// FE-092 — Drawer trượt phải dùng chung. Thay cho các admin page tự viết
// `transform: translateX(...)` + overlay riêng. Khóa scroll body khi mở, bắt
// phím Esc, click overlay để đóng (có thể tắt bằng dismissOnOverlayClick).
"use client";
import { useEffect, type ReactNode } from "react";

export interface DrawerAction {
  label: string;
  onClick: () => void | Promise<void>;
  kind?: "primary" | "danger" | "ghost";
  disabled?: boolean;
}

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footerActions?: DrawerAction[];
  width?: number;   // px, mặc định 420
  dismissOnOverlayClick?: boolean; // mặc định true
}

export function Drawer({ open, title, onClose, children, footerActions, width = 420, dismissOnOverlayClick = true }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    <>
      {/* overlay — pointer events chỉ khi open để không chặn click lúc đóng */}
      <div
        className="fixed inset-0 z-[150] transition-opacity duration-200"
        style={{
          background: "rgba(15, 23, 42, 0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={() => { if (dismissOnOverlayClick) onClose(); }}
        aria-hidden
      />
      {/* panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[151] bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out"
        style={{ width: `min(${width}px, 100vw)`, transform: open ? "translateX(0)" : "translateX(100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footerActions && footerActions.length > 0 ? (
          <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
            {footerActions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={
                  a.kind === "danger"
                    ? "px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    : a.kind === "ghost"
                    ? "px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    : "px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                }
                style={a.kind === "primary" || !a.kind ? { background: "linear-gradient(135deg, #4F6BF5, #6B4FE8)" } : undefined}
              >{a.label}</button>
            ))}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
