// SCL-G-SD — hộp "bài nộp" của sổ điểm: nội dung do trang máy chủ dựng (form POST + 303 như cũ), đây chỉ là khung KinDialog luôn mở.
// Đóng (nút Đóng, Escape, bấm nền) = về lại sổ điểm không có ?mo=.
"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { KinDialog } from "@/components/kin/Dialog";

export function SoDiemHop({ title, closeHref, footer, children }: { title: string; closeHref: string; footer?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  return <KinDialog open size="lg" title={title} footer={footer} onClose={() => router.push(closeHref, { scroll: false })}>{children}</KinDialog>;
}
