// Nút "Mở thanh bên" ở dải trên của vỏ. Chỉ hiện khi thanh đang THU và trên máy tính (CSS .kin-rail-open ở kin-tokens.css); điện thoại luôn có thanh dưới.
// Khi thu, thanh bên ẩn luôn cả chấm đỏ "còn việc" của module, nên nút này mang chấm đỏ thay (và nói số việc bằng chữ cho trình đọc màn hình).
"use client";
import { lastOpenRail, useRail } from "./railStore";

export function RailOpenButton({ pending = 0 }: { pending?: number }) {
  const [state, setState] = useRail();
  const label = pending > 0 ? `Mở thanh bên, có ${pending} việc cần xử lý` : "Mở thanh bên";
  return (
    <button
      type="button"
      data-rail-open
      aria-label={label}
      aria-expanded={state !== "thu"}
      aria-controls="kin-rail"
      title="Mở thanh bên (phím [)"
      onClick={() => {
        setState(lastOpenRail());
        // Thanh vừa hiện lại: đưa tiêu điểm sang nút đối diện để người dùng bàn phím không bị mất chỗ.
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-rail-close]")?.focus());
      }}
      className="kin-rail-open relative min-w-11 h-11 items-center justify-center rounded-[var(--kin-bo-sm)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)] hover:text-[var(--kin-chu-chinh)] transition-colors"
    >
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /><path d="M13.5 10l2 2-2 2" />
      </svg>
      {pending > 0 && <span data-rail-dot aria-hidden className="absolute top-[9px] right-[9px] w-[9px] h-[9px] rounded-full border-2 border-[var(--kin-nen-trang)] bg-[var(--kin-tt-chu-loi)]" />}
    </button>
  );
}
