// Khối gập / mở mượt. Chuyển động theo Lucian UX/UI Prompt #200 (biên lai gấp) và No.044 (FAQ) · MIT License (c) 2026 Seokwoooo ·
// https://lucianlabs.dev/uxui-prompt/#200 — chiều cao đổi từ 0 sang hết cỡ bằng grid-template-rows 0fr → 1fr (0,45 giây, không đo chiều cao bằng JS),
// nội dung mờ dần vào/ra. Khối đóng bị `inert` nên không ai Tab vào hoặc đọc nhầm phần đang ẩn. CSS .kin-fold* ở src/app/kin-motion.css.
// Điều khiển từ ngoài (open + nút bấm do nơi dùng đặt, nối bằng aria-controls = id) để nơi dùng tự chọn dáng nút.
"use client";
import type { ReactNode } from "react";

export function KinFold({ open, id, children, className = "" }: { open: boolean; id: string; children: ReactNode; className?: string }) {
  return (
    <div className={`kin-fold kin-m ${className}`} data-open={open ? "" : undefined}>
      <div className="kin-fold-in" id={id} inert={!open}>{children}</div>
    </div>
  );
}

/** Mũi tên xoay 180° khi mở (đặt trong nút bật/tắt; nút phải có data-open hoặc đặt `open`). */
export function KinChevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="kin-chevron w-4 h-4" data-open={open ? "" : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
  );
}
