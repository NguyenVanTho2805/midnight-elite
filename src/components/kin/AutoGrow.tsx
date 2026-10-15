// Ô nhập tự dãn + vòng đếm ký tự. Chuyển động theo Lucian UX/UI Prompt #028 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#028
// (CSS .kin-grow, .kin-chars* ở src/app/kin-motion.css): ô cao dần theo chữ (0,25 giây) tới một mức rồi mới cuộn; vòng tròn nhỏ đầy dần theo số ký tự đã dùng,
// gần hết thì vòng phóng to + đổi sang màu chờ và hiện số ký tự còn lại, vượt thì màu lỗi.
// Chiều cao đặt thẳng vào style của ô (đo bằng scrollHeight); đo xong mới bật lại chuyển cảnh để chiều cao CŨ → MỚI mượt, kể cả khi chữ bị xoá hết (ô co lại).
"use client";
import { useLayoutEffect, type RefObject } from "react";

/** Cho một <textarea> tự cao theo nội dung, tối đa `maxPx` (quá thì cuộn). Chiều cao tối thiểu là chiều cao của `rows` hiện có. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxPx = 240): void {
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const before = ta.style.height;
    ta.style.transition = "none";
    ta.style.height = "auto";
    const need = Math.min(maxPx, ta.scrollHeight);
    ta.style.height = before || `${ta.offsetHeight}px`;
    void ta.offsetHeight; // ép tính lại để chiều cao cũ được ghi nhận làm điểm xuất phát
    ta.style.transition = "";
    ta.style.height = `${need}px`;
    ta.style.overflowY = ta.scrollHeight > maxPx ? "auto" : "hidden";
  }, [ref, value, maxPx]);
}

/** Vòng đếm ký tự: `count` đã dùng / `max`. Gần hết (≤ 12% hoặc ≤ 20 ký tự) thì hiện số còn lại. */
export function KinCharRing({ count, max }: { count: number; max: number }) {
  const left = max - count;
  const near = Math.max(20, Math.round(max * 0.12));
  const p = Math.min(1, count / max);
  const note = left < 0 ? "Quá giới hạn ký tự" : left === near || left === 0 ? `Còn ${left} ký tự` : "";
  return (
    <span className="kin-chars kin-m" data-near={left <= near ? "" : undefined} data-over={left < 0 ? "" : undefined} style={{ "--p": p } as React.CSSProperties} title={`${count}/${max} ký tự`}>
      <svg viewBox="0 0 30 30" aria-hidden="true"><circle className="bg" cx="15" cy="15" r="12" /><circle className="fg" cx="15" cy="15" r="12" /></svg>
      <span className="kin-chars-left" aria-hidden="true">{left}</span>
      <span className="sr-only" role="status" aria-live="polite">{note}</span>
    </span>
  );
}
