// Vòng tiến độ "x/y việc đã xong". Chuyển động theo Lucian UX/UI Prompt #014 (vòng tiến độ đầy dần 0,7 giây, đổi màu xong, dấu tích bật ra) và
// No.093 (đủ việc → sóng lan quanh huy hiệu) · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#014 · https://lucianlabs.dev/uxui-prompt/#093
// (CSS .kin-ring* ở src/app/kin-motion.css). Bản gốc No.093 bắn confetti vẽ bằng rAF; ở đây thay bằng mười chấm nhỏ toả ra (chỉ CSS) cho nhẹ và hợp một danh sách việc.
// Hiệu ứng ăn mừng chỉ phát khi tiến độ VỪA chuyển sang "đủ" (không phát lúc mở trang khi mọi việc đã xong từ trước).
"use client";
import { useEffect, useRef } from "react";
import { replayClass } from "@/lib/replayClass";

const DOTS = ["var(--kin-tt-chu-xong)", "var(--kin-nhan-link)", "var(--kin-th-vang-nang)", "var(--kin-th-xanh-troi)", "var(--kin-tt-chu-xong)", "var(--kin-nhan-link)", "var(--kin-th-vang-nang)", "var(--kin-th-xanh-troi)", "var(--kin-tt-chu-xong)", "var(--kin-nhan-link)"];

export function KinProgressRing({ done, total, size = 44, label }: { done: number; total: number; size?: number; label: string }) {
  const all = total > 0 && done >= total;
  const root = useRef<HTMLDivElement>(null);
  const was = useRef(all);
  useEffect(() => {
    if (all && !was.current) replayClass(root.current, "kin-ring-burst");
    was.current = all;
  }, [all]);
  const p = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div ref={root} className="kin-ring kin-m" data-all={all ? "" : undefined} style={{ width: size, height: size, "--p": p } as React.CSSProperties} role="img" aria-label={`${label}: ${done} trên ${total}`}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><circle className="bg" cx="24" cy="24" r="20" /><circle className="fg" cx="24" cy="24" r="20" /></svg>
      <span className="kin-ring-num" aria-hidden="true">{done}/{total}</span>
      <span className="kin-ring-done" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.4" /></svg></span>
      {DOTS.map((c, i) => <span key={i} className="kin-ring-p" aria-hidden="true" style={{ "--a": `${i * 36}deg`, "--c": c } as React.CSSProperties} />)}
    </div>
  );
}
