"use client";
// Tờ trượt đáy (điện thoại) / hộp thoại 480px (≥ 640px) bằng <dialog> gốc.
// Đóng bằng nút "Đóng", Esc, chạm nền. Tiêu điểm đầu: phần tử có `data-autofocus` nếu có. Chuyển động 240ms, tắt khi giảm chuyển động (globals.css).
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconDong } from "../bieu-tuong";
import { nutBieuTuong } from "./nut";

export function ToTruot({ mo, dong, tieuDe, children, chan }: { mo: boolean; dong: () => void; tieuDe: ReactNode; children: ReactNode; chan?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mo && !d.open) {
      d.showModal();
      // showModal() đưa tiêu điểm về phần tử bấm được đầu tiên (nút Đóng). Nút an toàn đánh dấu `data-autofocus`
      // (vd. "Giữ buổi") nhận tiêu điểm sau đó — autoFocus của React chạy trước showModal nên bị ghi đè.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!mo && d.open) d.close();
  }, [mo]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="to-truot bong-noi bg-surface p-0 text-text"
      onClose={dong}
      onClick={(e) => { if (e.target === e.currentTarget) dong(); }}
    >
      {mo ? (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-input sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-5">
            <h2 id={id} className="pt-2 text-lg font-semibold leading-snug">{tieuDe}</h2>
            <button type="button" className={nutBieuTuong} onClick={dong} aria-label="Đóng"><IconDong /></button>
          </div>
          <div className="overflow-y-auto px-4 pb-4 pt-2 sm:px-6">{children}</div>
          {chan ? <div className="day-an-toan border-t border-border px-4 py-3 sm:px-6">{chan}</div> : <div className="day-an-toan" />}
        </div>
      ) : null}
    </dialog>
  );
}
