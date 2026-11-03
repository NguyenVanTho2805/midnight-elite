// Khung xem trước trang chủ (HOME-02): iframe cùng origin tới /admin/trang-chu/xem-truoc, nên điểm gãy theo khung nhìn (sm:/lg:) chạy đúng.
// Máy tính = iframe rộng 1280 logic thu nhỏ bằng transform; Điện thoại = iframe 390 (thu nhỏ nếu cột hẹp hơn). Chỉ gửi bản NHÁP HỢP LỆ; trang con tự kiểm lại.
"use client";
import { useEffect, useRef, useState } from "react";
import type { HomeContent } from "@/lib/siteContent";

export const PREVIEW_MSG = "kin-home-preview", PREVIEW_READY = "kin-home-ready", PREVIEW_HEIGHT = "kin-home-height";
type Mode = "may-tinh" | "dien-thoai";
const WIDTH: Record<Mode, number> = { "may-tinh": 1280, "dien-thoai": 390 };

export default function PreviewFrame({ draft, valid }: { draft: HomeContent; valid: boolean }) {
  const [mode, setMode] = useState<Mode>("may-tinh");
  const [boxW, setBoxW] = useState(0);
  const [h, setH] = useState(1400);
  const box = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false), latest = useRef(draft), validRef = useRef(valid);

  const send = () => {
    if (ready.current && validRef.current) frame.current?.contentWindow?.postMessage({ type: PREVIEW_MSG, content: latest.current }, location.origin);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el); setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; height?: number } | null;
      if (d?.type === PREVIEW_READY) { ready.current = true; send(); }
      else if (d?.type === PREVIEW_HEIGHT && typeof d.height === "number" && d.height > 0) setH(Math.ceil(d.height));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    latest.current = draft; validRef.current = valid;
    const t = setTimeout(send, 150);
    return () => clearTimeout(t);
  }, [draft, valid]);

  const W = WIDTH[mode];
  const scale = boxW > 0 ? Math.min(1, boxW / W) : 1;
  const left = mode === "dien-thoai" ? Math.max(0, (boxW - W * scale) / 2) : 0;
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div role="radiogroup" aria-label="Kiểu màn hình xem trước" className="inline-flex gap-2">
        {([["may-tinh", "Máy tính"], ["dien-thoai", "Điện thoại"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} data-preview-mode={k} onClick={() => setMode(k)}
            className={`min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] font-medium ${mode === k ? "border-2 border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"}`}>
            {label}
          </button>
        ))}
      </div>
      <div ref={box} className="relative w-full overflow-hidden rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)]" style={{ height: Math.round(h * scale) }}>
        <iframe ref={frame} title="Xem trước trang chủ" src="/admin/trang-chu/xem-truoc" data-preview-frame={mode}
          onLoad={() => { /* trang con tự báo ready; nạp lại thì phải chờ ready mới */ }}
          style={{ position: "absolute", top: 0, left, width: W, height: h, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
      </div>
      <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
        Số liệu thật (học sinh, đề thi, gia sư) hiện ở trang công khai, không hiện ở bản xem trước.
        {!valid && " Có chỗ chưa hợp lệ, bản xem trước đang giữ bản hợp lệ gần nhất."}
      </p>
    </div>
  );
}
