// SCL-F2 (P2-29): MỘT hệ toast. AdminToast cũ tự vẽ một khối nổi riêng; nay chỉ là lớp chuyển sang useToast (KinToast, ToastProvider ở layout gốc).
// Giữ tên cũ để các trang admin chưa sửa vẫn chạy; trang mới gọi thẳng useToast từ "@/components/kin/ToastProvider".
"use client";
import { useToast } from "@/components/kin/ToastProvider";

/** Không còn vẽ gì: toast hiện qua ToastProvider. Giữ để `{toast && <AdminToast …/>}` cũ không vỡ. */
export const AdminToast: (props: { msg: string; ok: boolean }) => null = () => null;

export function useAdminToast() {
  const t = useToast();
  return { toast: null as { msg: string; ok: boolean } | null, showToast: (msg: string, ok = true) => (ok ? t.ok(msg) : t.err(msg)) };
}
