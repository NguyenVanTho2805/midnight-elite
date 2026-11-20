// GS-LOP-GON — ngăn bên phải của cây Phần / Chương / Bài, CẮT từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`, nút ≥ 44px, nhãn "Đang tải tệp…" khi còn tệp đang lên).
// LOI-07: bỏ `DelModal` (hộp xoá viết tay) — không còn ai dùng; cây xoá bằng KinConfirm.
"use client";
import { Toggle } from "@/components/Toggle";

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
