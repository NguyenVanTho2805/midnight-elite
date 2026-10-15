// Nút gửi biểu mẫu có phản hồi. Chuyển động theo Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062
// (CSS .kin-go* ở src/app/kin-motion.css): bấm gửi → nút co thành vòng tròn (0,45 giây, lò xo) và hiện chữ K đang chạy; thất bại → giãn lại thành nút;
// thành công → vòng tròn đổi sang màu xong và dấu tích được vẽ. KHÔNG dùng vòng xoay chung chung: Figma KiN quy định "dùng chữ, không dùng spinner"
// (xem Button.tsx), nên bên trong vòng tròn là logo K (cùng chuyển động với KinLoader).
// Trợ năng: chữ nhãn vẫn nằm trong nút (chỉ mờ đi) nên tên đọc của nút đổi thành `busyLabel` ("Đang đăng nhập…") khi đang gửi; aria-busy.
"use client";
import type { ReactNode } from "react";
import { KinMark } from "./KinLogo";

export function KinSubmitButton({ busy, ok = false, busyLabel, children, disabled, className = "" }: {
  busy: boolean;
  /** Đã thành công (đang chờ chuyển trang). */
  ok?: boolean;
  busyLabel: string;
  children: ReactNode;
  disabled?: boolean;
  /** Dáng nút (viền, màu, chữ) do nơi dùng đặt; chiều rộng đầy khi nghỉ. */
  className?: string;
}) {
  const state = ok ? "ok" : busy ? "busy" : "idle";
  return (
    <button type="submit" disabled={disabled || busy || ok} aria-busy={busy || undefined} data-state={state} className={`kin-go kin-m ${className}`}>
      <span className="kin-go-label">{busy ? busyLabel : children}</span>
      <span className="kin-go-spin kin-loader" aria-hidden="true"><KinMark size={22} /></span>
      <svg className="kin-go-ok" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5l4.2 4.2L18 8" /></svg>
    </button>
  );
}
