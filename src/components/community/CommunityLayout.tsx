// BU-05 — khung 3 / 2 / 1 cột theo container query (xem community.css). Chỉ bố trí; không biết gì về dữ liệu.
import type { ReactNode } from "react";
import "./community.css";

export function CommunityLayout({ nav, rail, children }: { nav: ReactNode; rail: ReactNode; children: ReactNode }) {
  return (
    <div className="kc-root" data-kc-root>
      <div className="kc-grid">
        {nav}
        <div className="kc-main">{children}</div>
        <aside className="kc-rail" aria-label="Gợi ý cho bạn">{rail}</aside>
      </div>
    </div>
  );
}
