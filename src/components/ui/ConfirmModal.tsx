// FE-093 — Modal xác nhận dùng chung. Thay `window.confirm()` (admin/danh-gia)
// và các modal tự viết. Bắt Escape + Enter (Enter = confirmLabel), lock scroll.
"use client";
import { useEffect, useRef } from "react";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;        // mặc định "Xác nhận"
  cancelLabel?: string;         // mặc định "Hủy"
  danger?: boolean;             // true → nút confirm màu đỏ
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;            // disable nút khi đang submit
}

export function ConfirmModal({
  open, title, message, confirmLabel = "Xác nhận", cancelLabel = "Hủy",
  danger, onConfirm, onCancel, loading,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter" && !loading) onConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onCancel, onConfirm, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.5)" }}
      onClick={onCancel}
      role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2">
          <h2 id="confirm-modal-title" className="text-base font-semibold text-slate-800">{title}</h2>
          {message ? <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{message}</p> : null}
        </div>
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? "px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                : "px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            }
            style={!danger ? { background: "linear-gradient(135deg, #4F6BF5, #6B4FE8)" } : undefined}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
