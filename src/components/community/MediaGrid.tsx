"use client";
// BU-05 — lưới ảnh 1 / 2 / 2×2 (tối đa 4), bo --kin-bo-md, bấm mở xem lớn (Lightbox có sẵn ở ThreadDetailShared).
import { useState } from "react";
import { Lightbox } from "@/components/community/ThreadDetailShared";

export function MediaGrid({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = urls.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <>
      <div className="kc-media" data-n={shown.length === 1 ? "1" : String(shown.length)}>
        {shown.map((u, i) => (
          <button key={u + i} type="button" onClick={() => setOpen(i)} aria-label={`Xem ảnh ${i + 1} trên ${shown.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh người dùng tải lên Cloudinary, kích thước chưa biết */}
            <img src={u} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox urls={shown} initial={open} onClose={() => setOpen(null)} />}
    </>
  );
}
