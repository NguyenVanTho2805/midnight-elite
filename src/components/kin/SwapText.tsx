// Dòng chữ đổi nội dung bằng cách trượt: chữ cũ trượt lên rồi mờ, chữ mới từ dưới trượt vào (0,5 giây, lò xo).
// Chuyển động theo Lucian UX/UI Prompt #014 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#014 (CSS .kin-swap ở src/app/kin-motion.css).
// Chỉ có MỘT câu hiện cho trình đọc màn hình (câu kia aria-hidden) và vùng aria-live báo khi đổi.
import type { ReactNode } from "react";

export function KinSwapText({ alt, a, b }: { alt: boolean; a: ReactNode; b: ReactNode }) {
  return (
    <span className="kin-swap kin-m" data-alt={alt ? "" : undefined} aria-live="polite">
      <span aria-hidden={alt || undefined}>{a}</span>
      <span aria-hidden={!alt || undefined}>{b}</span>
    </span>
  );
}
