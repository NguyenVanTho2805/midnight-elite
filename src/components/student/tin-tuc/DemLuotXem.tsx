"use client";
// Đếm lượt xem đúng 1 lần mỗi lần mở trang: sau ≥ 3 giây hoặc khi có cuộn. SSR/trình thu thập không bao giờ chạy đoạn này.
import { useEffect } from "react";

export function DemLuotXem({ slug }: { slug: string }) {
  useEffect(() => {
    let daGui = false;
    const gui = () => {
      if (daGui) return;
      daGui = true;
      clearTimeout(hen);
      window.removeEventListener("scroll", gui);
      fetch(`/api/articles/${encodeURIComponent(slug)}/view`, { method: "POST", keepalive: true }).catch(() => { /* lượt xem chỉ để xếp hạng, lỗi thì bỏ qua */ });
    };
    const hen = setTimeout(gui, 3000);
    window.addEventListener("scroll", gui, { passive: true });
    return () => { clearTimeout(hen); window.removeEventListener("scroll", gui); };
  }, [slug]);
  return null;
}
