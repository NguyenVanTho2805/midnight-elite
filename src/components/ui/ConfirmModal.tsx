// FE-093 — Modal xác nhận dùng chung (giữ API cũ). Từ 13/10/2026 vẽ bằng KinConfirm (Figma "Hộp xác nhận" 106:51):
// `danger` → loại "nguy-hiem" (tiêu đề đỏ, nút xác nhận đỏ đặc, tiêu điểm đầu tiên ở nút Huỷ).
// Khác bản cũ: Enter KHÔNG còn xác nhận từ bất kỳ đâu — chỉ nút đang có tiêu điểm mới nhận Enter.
"use client";
import { KinConfirm } from "@/components/kin/Confirm";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;        // mặc định "Xác nhận"
  cancelLabel?: string;         // mặc định "Huỷ"
  danger?: boolean;             // true → loại nguy hiểm
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;            // khoá nút khi đang gửi
}

export function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <KinConfirm open={open} title={title} message={message} confirmLabel={confirmLabel} cancelLabel={cancelLabel}
      tone={danger ? "nguy-hiem" : "thuong"} loading={loading} onConfirm={onConfirm} onCancel={onCancel} />
  );
}
