"use client";
// BU-05 — chọn ảnh kèm bài / trả lời (giữ nguyên đường tải hiện có: uploadMany → Cloudinary; không thêm đường mới).
// Hiện xem trước, bấm × (44px) để bỏ. Tải lên xảy ra lúc gửi, không phải lúc chọn.
import { useEffect, useMemo, useRef } from "react";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { ImageIcon } from "./Icons";

export function ImagePicker({ files, onChange, max, disabled }: { files: File[]; onChange: (f: File[]) => void; max: number; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="flex flex-col gap-2">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={f.name + i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- xem trước tệp cục bộ (blob:) */}
              <img src={urls[i]} alt={`Ảnh đã chọn ${i + 1}`} className="h-16 w-16 rounded-[var(--kin-bo-md)] object-cover" />
              <button type="button" aria-label={`Bỏ ảnh ${i + 1}`} onClick={() => onChange(files.filter((_, k) => k !== i))}
                className="absolute -right-2 -top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={disabled || files.length >= max || !cloudinaryConfigured}
        onClick={() => ref.current?.click()}
        className="kc-act self-start" style={{ marginLeft: -10 }}>
        <ImageIcon /><span>Ảnh{files.length ? ` (${files.length}/${max})` : ""}</span>
      </button>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, max)); e.target.value = ""; }} />
      {!cloudinaryConfigured && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Tạm thời chưa đính kèm được ảnh.</p>}
    </div>
  );
}
