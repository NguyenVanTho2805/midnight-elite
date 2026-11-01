// BU-06 — video giới thiệu của gia sư: chỉ YouTube, qua mã 11 ký tự do máy chủ đã tách (xem lib/youtubeLink.ts).
// Trước khi bấm chỉ có ảnh nhỏ + nút phát (KHÔNG có iframe trong DOM, không gọi bên thứ ba để phát); bấm mới nạp youtube-nocookie.
// Luôn có liên kết chữ "Xem trên YouTube" làm lối thoát khi iframe bị chặn.
"use client";
import { useState } from "react";

export function VideoGioiThieu({ name, video }: { name: string; video: { embedUrl: string; watchUrl: string; thumbUrl: string } }) {
  const [playing, setPlaying] = useState(false);
  return (
    <section aria-label={`Video giới thiệu của ${name}`} data-intro-video className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)]" style={{ background: "var(--kin-nen-bang)" }}>
        {playing ? (
          <iframe
            src={`${video.embedUrl}?rel=0&autoplay=1`} title={`Video giới thiệu của ${name}`}
            allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Phát video giới thiệu của ${name}`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)] group-hover:bg-[var(--kin-nen-re-chuot)]">▶</span>
          </button>
        )}
      </div>
      <a href={video.watchUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center self-start text-[length:var(--kin-co-small)] text-[var(--kin-nhan-link)] underline">
        Xem trên YouTube
      </a>
    </section>
  );
}
