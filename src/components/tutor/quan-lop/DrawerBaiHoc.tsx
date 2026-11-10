// GS-LOP-GON — ngăn bên phải + hộp xoá của cây Phần / Chương / Bài, CẮT từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`, nút ≥ 44px, nhãn "Đang tải tệp…" khi còn tệp đang lên).
"use client";
import { Toggle } from "@/components/Toggle";
import type { DelTarget } from "./lessonForm";

export function DrawerToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function Drawer({ open, title, onClose, onSave, saving, busy, children }: {
  open: boolean; title: string; onClose: () => void; onSave: () => void;
  saving?: boolean;
  /** Còn tệp đang tải lên: khoá nút Lưu (lưu lúc này sẽ bỏ sót tệp), hiện chữ "Đang tải tệp…". */
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-[var(--kin-nen-trang)] overflow-y-auto shadow-2xl"
        style={{
          width: "min(480px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-[var(--kin-nen-trang)] z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Đóng" className="w-11 h-11 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light transition-colors">×</button>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 min-h-11 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Huỷ</button>
            <button type="button" onClick={onSave} disabled={saving || busy}
              className="px-4 min-h-11 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
              style={{ background: "var(--kin-nhan-nen)" }}>
              {saving ? "Đang lưu..." : busy ? "Đang tải tệp…" : "Lưu"}
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </>
  );
}

export function DelModal({ target, onClose, onConfirm }: { target: DelTarget; onClose: () => void; onConfirm: () => void }) {
  if (!target) return null;
  const kind = target.kind === "section" ? "phần" : target.kind === "chapter" ? "chương" : "bài học";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--kin-nen-trang)] rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--kin-tt-nen-loi)" }}>
            <svg viewBox="0 0 20 20" className="w-7 h-7" fill="var(--kin-tt-chu-loi)"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          </div>
          <h2 className="text-base font-bold text-gray-800 mb-1">Xoá {kind}?</h2>
          <p className="text-sm text-gray-500">
            Xoá <strong className="text-gray-800">"{target.kind === "section" ? target.label : target.kind === "chapter" ? target.label : target.label}"</strong>
            {target.kind !== "lesson" ? " sẽ xoá toàn bộ nội dung bên trong." : "."} Không thể hoàn tác.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 min-h-11 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={onConfirm} className="flex-1 min-h-11 rounded-xl text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-tt-chu-loi)" }}>Xoá</button>
        </div>
      </div>
    </div>
  );
}
