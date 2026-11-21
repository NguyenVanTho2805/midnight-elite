// SCL-G-0 (21/11/2026) — hộp thoại chung KiN (phần I "Tiếp cận"): một khung cho mọi hộp không phải câu hỏi Có/Không (câu hỏi đó dùng KinConfirm).
// Hành vi lấy từ useModalDialog: Escape đóng, Tab xoay vòng trong hộp, khoá cuộn trang, tiêu điểm vào hộp khi mở và trả về chỗ cũ khi đóng.
// role="dialog" aria-modal, tiêu đề nối bằng aria-labelledby, nút "Đóng" có chữ (≥ 44px). Hiện ra bằng mờ dần + trượt 8px trong 180ms (chỉ opacity/transform),
// tắt dưới prefers-reduced-motion (.kin-hop-vao ở kin-site.css).
"use client";
import { useId, useRef, type ReactNode } from "react";
import { KinButton } from "./Button";
import { useModalDialog } from "./useModalDialog";

export interface KinDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Hàng nút cuối hộp (tối đa một nút chính). */
  footer?: ReactNode;
  /** Bề rộng tối đa: md 480px, lg 640px. */
  size?: "md" | "lg";
}

export function KinDialog({ open, title, onClose, children, footer, size = "md" }: KinDialogProps) {
  const titleId = `${useId()}-tieu-de`;
  const boxRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useModalDialog(open, boxRef, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-[var(--kin-phu-hop)]" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-kin-dialog onKeyDown={onKeyDown} onClick={e => e.stopPropagation()}
        className={`kin-hop-vao w-full ${size === "lg" ? "sm:max-w-[640px]" : "sm:max-w-[480px]"} max-h-[90vh] flex flex-col rounded-t-[var(--kin-bo-the)] sm:rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-hop)] outline-none`}>
        <div className="flex items-start gap-3 pt-[18px] pb-3 px-6 border-b border-[var(--kin-vien-nhat)]">
          <h2 id={titleId} className="kin-chu-tieu-de flex-1 min-w-0 pt-2 font-semibold text-[length:var(--kin-co-tieu-de)] leading-7 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{title}</h2>
          <KinButton type="button" variant="ghost" onClick={onClose}>Đóng</KinButton>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-[10px] px-6 pt-3 pb-5 border-t border-[var(--kin-vien-nhat)]">{footer}</div>}
      </div>
    </div>
  );
}
