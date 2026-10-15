// Đếm ngược khi bị khoá đăng nhập vì sai nhiều lần. Chuyển động theo Lucian UX/UI Prompt #067 · MIT License (c) 2026 Seokwoooo ·
// https://lucianlabs.dev/uxui-prompt/#067 (CSS .kin-lock* ở src/app/kin-motion.css): vòng quanh ổ khoá co dần theo thời gian còn lại, số đếm ngược,
// hết giờ thì quai khoá bật mở (lò xo 0,7 giây), vòng đổi màu xong và dòng chữ đổi từ "Tạm khoá" sang "Bạn có thể thử lại".
// Thời gian lấy từ máy chủ (retryAfterSec) — đây chỉ là cách HIỂN THỊ; máy chủ mới là nơi quyết định khoá, nên bấm "thử lại" sớm vẫn bị máy chủ chặn.
// Vòng cập nhật thẳng lên DOM mỗi khung hình (không qua state); người đặt "giảm chuyển động" thì vòng chỉ nhảy mỗi giây.
"use client";
import { useEffect, useRef, useState } from "react";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const words = (s: number) => s >= 60 ? `${Math.floor(s / 60)} phút ${s % 60} giây` : `${s} giây`;

export function LockCountdown({ seconds, onRetry, lockedTitle = "Tạm khoá đăng nhập", openTitle = "Bạn có thể thử lại", retryLabel = "Thử đăng nhập lại" }: {
  seconds: number;
  onRetry: () => void;
  lockedTitle?: string;
  openTitle?: string;
  retryLabel?: string;
}) {
  const total = Math.max(1, Math.round(seconds));
  const dial = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t0 = performance.now();
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, lastShown = -1;
    const tick = (now: number) => {
      const left = Math.max(0, total - (now - t0) / 1000), s = Math.ceil(left);
      if (dial.current && (!reduce || s !== lastShown)) dial.current.style.setProperty("--p", (reduce ? s / total : left / total).toFixed(4));
      if (s !== lastShown) {
        lastShown = s;
        if (time.current) time.current.textContent = mmss(s);
        dial.current?.setAttribute("aria-label", `Còn ${words(s)}`);
      }
      if (left <= 0) { setOpen(true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div className="kin-lock kin-m flex flex-col items-center gap-2 py-1" data-open={open ? "" : undefined}>
      <div ref={dial} className="kin-lock-dial" role="timer" aria-live="off" aria-label={`Còn ${words(total)}`}>
        <svg viewBox="0 0 168 168" aria-hidden="true"><circle className="t" cx="84" cy="84" r="78" /><circle className="p" cx="84" cy="84" r="78" pathLength="100" /></svg>
        <span className="kin-lock-icon" aria-hidden="true">
          <svg viewBox="0 0 62 70"><path className="sh" d="M16 32V22a15 15 0 0 1 30 0v10" /><rect className="bd" x="6" y="30" width="50" height="38" rx="10" /><circle className="kh" cx="31" cy="47" r="5" /><rect className="kh" x="29" y="49" width="4" height="10" rx="2" /></svg>
        </span>
        <span ref={time} className="kin-lock-time" aria-hidden="true">{mmss(total)}</span>
      </div>
      <div className="kin-lock-title" aria-live="polite">
        <p className="a">{lockedTitle}</p>
        <p className="b">{openTitle}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={!open} className="kin-lock-retry min-h-11 px-4 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-small)] font-semibold">{retryLabel}</button>
    </div>
  );
}
