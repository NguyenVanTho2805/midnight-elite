// GS-LOP-GON — ngăn bên phải của cây Phần / Chương / Bài, CẮT từ admin/khoa-hoc/[id]/page.tsx (chỉ thêm `export`, nút ≥ 44px, nhãn "Đang tải tệp…" khi còn tệp đang lên).
// LOI-07: bỏ `DelModal` (hộp xoá viết tay) — không còn ai dùng; cây xoá bằng KinConfirm.
// SCL-D (P2-34): ngăn là hộp thoại thật (role=dialog, aria-modal, tên = tiêu đề): Escape đóng, Tab không lọt ra ngoài, trả tiêu điểm khi đóng; màu chỉ token.
// Bỏ DrawerToggle (Khoá bài / Học thử không còn trong ngăn).
// SCL-G-GS (QUYET-DINH §2.2): `inline` (máy tính ≥1024px) = ngăn LUÔN MỞ ở cột phải trang lớp — vùng có tên (region), không phủ nền, không bẫy Tab; nút Lưu là nút PHỤ
// (nút chính của màn là "+ Giao bài"). Chưa chọn gì thì `empty` thay thân ngăn. Dưới 1024px vẫn là hộp thoại như cũ.
"use client";
import { useId, useRef, type ReactNode } from "react";
import { useModalDialog } from "@/components/kin/useModalDialog";
import { kinButtonClass } from "@/components/kin/buttonClass";

export function Drawer({ open, title, onClose, onSave, saving, busy, inline = false, empty, closeLabel = "Huỷ", menu, autoSaved = false, status, children }: {
  open: boolean; title: string; onClose: () => void; onSave: () => void;
  saving?: boolean;
  /** Còn tệp đang tải lên: khoá nút Lưu (lưu lúc này sẽ bỏ sót tệp), hiện chữ "Đang tải tệp…". */
  busy?: boolean;
  inline?: boolean;
  /** Thân ngăn khi `inline` mà chưa chọn gì. */
  empty?: ReactNode;
  closeLabel?: string;
  /** Nút ⋯ ở đầu ngăn (thao tác của bài đang sửa). */
  menu?: ReactNode;
  /** SCL-G-GS: ngăn tự lưu (Sửa bài học) — KHÔNG có nút Lưu, chỉ "Đóng"; `status` ("Đã tự lưu lúc …") đứng dưới tiêu đề. */
  autoSaved?: boolean;
  status?: ReactNode;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = `${useId()}-tieu-de`;
  const trapTab = useModalDialog(open && !inline, box, onClose);
  if (inline) {
    return (
      <section role="region" aria-labelledby={titleId} data-ngan-bai-hoc={open ? "mo" : "cho"} data-ngan-luon-mo
        className="sticky top-[calc(var(--kin-top,68px)+16px)] max-h-[calc(100vh-var(--kin-top,68px)-32px)] overflow-y-auto rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
          <div className="min-w-0">
            <h2 id={titleId} className="[overflow-wrap:anywhere] text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">{open ? title : "Sửa bài"}</h2>
            {open && status}
          </div>
          {open && (
            <div className="flex items-center gap-2">
              {menu}
              <button type="button" onClick={onClose} className={kinButtonClass("ghost")}>{closeLabel}</button>
              {!autoSaved && <button type="button" onClick={onSave} disabled={saving || busy} className={kinButtonClass("secondary")}>
                {saving ? "Đang lưu..." : busy ? "Đang tải tệp…" : "Lưu"}
              </button>}
            </div>
          )}
        </div>
        <div key={open ? title : "cho"} className="kin-hop-vao p-5 space-y-5">{open ? children : empty}</div>
        {/* Còn nội dung bên dưới: dải mờ dính đáy báo "cuộn tiếp" (ngăn cao tối đa bằng khung nhìn). */}
        <div aria-hidden className="pointer-events-none sticky bottom-0 -mt-5 h-5 bg-gradient-to-t from-[var(--kin-nen-trang)] to-transparent" />
      </section>
    );
  }
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-[var(--kin-phu-hop)]" onClick={onClose} />}
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={open ? undefined : true} tabIndex={-1} onKeyDown={trapTab}
        data-ngan-bai-hoc={open ? "mo" : "dong"}
        className="fixed top-0 right-0 bottom-0 z-50 bg-[var(--kin-nen-trang)] overflow-y-auto shadow-[var(--kin-bong-noi)] outline-none transition-transform duration-200 motion-reduce:transition-none"
        style={{
          width: "min(480px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-[var(--kin-nen-trang)] z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--kin-vien-thuong)]">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Đóng" className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] text-xl font-light transition-colors">×</button>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-[var(--kin-chu-chinh)]">{title}</h2>
              {status}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 min-h-11 text-sm border border-[var(--kin-vien-o-nhap)] rounded-lg text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">{closeLabel}</button>
            {!autoSaved && <button type="button" onClick={onSave} disabled={saving || busy}
              className="px-4 min-h-11 text-sm font-semibold rounded-lg disabled:opacity-60 bg-[var(--kin-nhan-nen)] text-[var(--kin-chu-tren-nut-chinh)]">
              {saving ? "Đang lưu..." : busy ? "Đang tải tệp…" : "Lưu"}
            </button>}
          </div>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </>
  );
}
