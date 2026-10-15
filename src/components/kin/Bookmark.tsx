// Nút lưu bài có dải đánh dấu. Chuyển động theo Lucian UX/UI Prompt #012 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#012
// (CSS .kin-mark* ở src/app/kin-motion.css): khi chuyển sang "đã lưu", màu đổ xuống dải từ trên (0,55 giây), dải rơi xuống rồi nảy lại (0,7 giây),
// một vòng sáng toả ra quanh nút (0,6 giây). Bỏ lưu thì tô lại ngay, không phát gì. Không có hạt confetti (bản gốc có) — hợp một nút nhỏ ở hàng thao tác hơn.
// Hiệu ứng chỉ phát khi trạng thái ĐỔI sang "đã lưu" (không phát lần vẽ đầu của một bài đã lưu từ trước).
"use client";
import { useEffect, useRef } from "react";
import { replayClass } from "@/lib/replayClass";

const PATH = "M5 4a2 2 0 012-2h10a2 2 0 012 2v18l-7-3.5L5 22V4z";

export function KinBookmark({ on, onToggle, busy = false, labelOn = "Bỏ lưu bài", labelOff = "Lưu bài", className = "" }: {
  on: boolean;
  onToggle: () => void;
  busy?: boolean;
  labelOn?: string;
  labelOff?: string;
  className?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current) replayClass(btn.current, "kin-mark-burst");
    was.current = on;
  }, [on]);
  return (
    <button ref={btn} type="button" onClick={onToggle} disabled={busy} aria-pressed={on}
      aria-label={on ? labelOn : labelOff} title={on ? labelOn : labelOff}
      data-on={on ? "" : undefined}
      className={`kin-mark kin-m relative px-2.5 py-1.5 rounded-lg ${className}`}
      style={{ color: on ? "var(--kin-nhan-link)" : "var(--kin-chu-mo)" }}>
      <span className="kin-mark-ring" aria-hidden="true" />
      <svg className="kin-mark-ico w-4 h-4" viewBox="0 0 24 24" aria-hidden="true" overflow="visible">
        <path className="kin-mark-in" d={PATH} fill="currentColor" />
        <path className="kin-mark-out" d={PATH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
