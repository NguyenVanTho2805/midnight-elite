// Thông báo nổi KiN (Figma "Toast" 106:23): thẻ trắng 400px, viền 1px, bo 10px, chấm 8px + tiêu đề đậm + dòng phụ 11,1px.
// 4 loại: xong / cho / loi / tin. Chấm và tiêu đề cùng màu loại; "tin" dùng xám trung tính.
// Màu không nói một mình: luôn có chữ. Loại "loi" là role=alert (đọc ngay), còn lại role=status.
"use client";
import type { ReactNode } from "react";
import { STATUS_DOT, STATUS_TEXT } from "./Status";

export type ToastTone = "xong" | "cho" | "loi" | "tin";

const DOT: Record<ToastTone, string> = { ...STATUS_DOT, tin: "var(--kin-tt-cham-trung-tinh)" };
const TITLE: Record<ToastTone, string> = { ...STATUS_TEXT, tin: "var(--kin-chu-phu)" };

export interface KinToastProps {
  tone: ToastTone;
  title: string;
  detail?: ReactNode;
  /** Có thì hiện nút × (Figma không vẽ, nhưng thông báo tự tắt sau vài giây nên người dùng bàn phím cần cách đóng sớm). */
  onClose?: () => void;
  className?: string;
}

export function KinToast({ tone, title, detail, onClose, className = "" }: KinToastProps) {
  return (
    <div
      role={tone === "loi" ? "alert" : "status"}
      data-kin-toast={tone}
      className={`flex items-start gap-[11px] w-full max-w-[400px] px-4 py-[14px] rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-toast)] ${className}`}
    >
      <span aria-hidden className="mt-1 inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: DOT[tone] }} />
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <p className="font-semibold text-[length:var(--kin-co-small)]" style={{ color: TITLE[tone] }}>{title}</p>
        {detail && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{detail}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="-my-1 -mr-2 w-7 h-7 flex-shrink-0 inline-flex items-center justify-center rounded-[var(--kin-bo-sm)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
        >×</button>
      )}
    </div>
  );
}
