// HOME-02 — khung xem trước trang chủ, nằm trong iframe của /admin/trang-chu. Vẽ ĐÚNG component của trang thật (HomeSections) với bản nháp nhận qua postMessage.
// Chỉ nhận thư cùng origin; bản nháp không hợp lệ thì giữ bản hợp lệ gần nhất (không vẽ nửa vời). stats=[] nên khối số liệu tự ẩn, không bịa số mẫu.
// Vỏ quản trị trả trang TRẦN cho đường dẫn này (AdminShell).
"use client";
import { useEffect, useRef, useState } from "react";
import HomeSections from "@/components/guest/HomeSections";
import { DEFAULT_HOME_CONTENT, validateHomeContent, type HomeContent } from "@/lib/siteContent";
import { PREVIEW_HEIGHT, PREVIEW_MSG, PREVIEW_READY } from "@/components/admin/home/PreviewFrame";

export default function XemTruocTrangChu() {
  const [content, setContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data as { type?: string; content?: unknown } | null;
      if (d?.type !== PREVIEW_MSG) return;
      const v = validateHomeContent(d.content);
      if (v.ok) setContent(v.value);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: PREVIEW_READY }, location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Báo chiều cao nội dung (không dùng min-h-screen để khỏi vòng lặp co giãn).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const tell = () => window.parent.postMessage({ type: PREVIEW_HEIGHT, height: el.getBoundingClientRect().height }, location.origin);
    const ro = new ResizeObserver(tell);
    ro.observe(el); tell();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} data-vung="sang" data-home-preview className="kin-chu-than bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"
      onClickCapture={e => { if ((e.target as Element).closest("a")) e.preventDefault(); }}>
      <main><HomeSections content={content} stats={[]} /></main>
    </div>
  );
}
