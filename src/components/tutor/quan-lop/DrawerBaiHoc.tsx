// GS-LOP-GON — ngăn bên phải của cây Phần / Chương / Bài, CẮT từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`, nút ≥ 44px, nhãn "Đang tải tệp…" khi còn tệp đang lên).
// LOI-07: bỏ `DelModal` (hộp xoá viết tay) — không còn ai dùng; cây xoá bằng KinConfirm.
// SCL-D (P2-34): ngăn là hộp thoại thật (role=dialog, aria-modal, tên = tiêu đề): Escape đóng, Tab không lọt ra ngoài, trả tiêu điểm khi đóng; màu chỉ token.
// Bỏ DrawerToggle (Khoá bài / Học thử không còn trong ngăn).
"use client";
import { useId, useRef } from "react";
import { useModalDialog } from "@/components/kin/useModalDialog";

export function Drawer({ open, title, onClose, onSave, saving, busy, children }: {
  open: boolean; title: string; onClose: () => void; onSave: () => void;
  saving?: boolean;
  /** Còn tệp đang tải lên: khoá nút Lưu (lưu lúc này sẽ bỏ sót tệp), hiện chữ "Đang tải tệp…". */
  busy?: boolean;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = `${useId()}-tieu-de`;
  const trapTab = useModalDialog(open, box, onClose);
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-[var(--kin-phu-hop)]" onClick={onClose} />}
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={open ? undefined : true} tabIndex={-1} onKeyDown={trapTab}
        data-ngan-bai-hoc={open ? "mo" : "dong"}
        className="fixed top-0 right-0 bottom-0 z-50 bg-[var(--kin-nen-trang)] overflow-y-auto shadow-[var(--kin-bong-noi)] outline-none"
        style={{
          width: "min(480px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-[var(--kin-nen-trang)] z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--kin-vien-thuong)]">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Đóng" className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] text-xl font-light transition-colors">×</button>
            <h2 id={titleId} className="text-base font-bold text-[var(--kin-chu-chinh)]">{title}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 min-h-11 text-sm border border-[var(--kin-vien-o-nhap)] rounded-lg text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">Huỷ</button>
            <button type="button" onClick={onSave} disabled={saving || busy}
              className="px-4 min-h-11 text-sm font-semibold rounded-lg disabled:opacity-60 bg-[var(--kin-nhan-nen)] text-[var(--kin-chu-tren-nut-chinh)]">
              {saving ? "Đang lưu..." : busy ? "Đang tải tệp…" : "Lưu"}
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </>
  );
}
