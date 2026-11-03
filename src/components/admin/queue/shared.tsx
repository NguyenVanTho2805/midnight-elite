// Mảnh dùng chung của Hàng chờ (BU-08): nhãn loại, ô chọn 44px, dải trạng thái/lỗi KHÔNG dùng role="alert" trần.
"use client";
import { useEffect, useRef } from "react";
import type { QueueItem } from "@/lib/adminQueue";

/** Thứ tự và nhãn loại. Loại ngoài bảng này vẫn hiện bằng khoá thô — không ném. */
export const KIND_ORDER = ["gia-su", "bai-viet", "ho-so", "tra-loi", "danh-gia", "nap-coin", "khach-hoi", "vao-lop"] as const;
export const KIND_LABEL: Record<string, string> = {
  "gia-su": "Hồ sơ gia sư", "bai-viet": "Bài viết", "ho-so": "Hồ sơ bị báo cáo", "tra-loi": "Câu trả lời",
  "danh-gia": "Đánh giá khoá", "nap-coin": "Nạp Coin", "khach-hoi": "Câu hỏi của khách", "vao-lop": "Chờ vào lớp",
};
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

/** Hàng chờ chỉ có 2 nút mỗi hàng: "Xem" + (nếu có) một lệnh nhanh. */
export function quickAction(item: QueueItem) {
  if (!item.quick) return null;
  return item.detail.actions.find(a => a.key === item.quick && !a.disabled && !a.reason && !a.confirm) ?? null;
}

/**
 * Ô tick: vùng bấm 44×44 (input trong suốt phủ cả ô), hình vuông 20px vẽ bằng token.
 * `mixed` = một phần được chọn (hiện gạch ngang).
 */
export function QueueCheck({ checked, mixed, onChange, label, testId }: { checked: boolean; mixed?: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!mixed && !checked; }, [mixed, checked]);
  return (
    <label className="relative inline-flex h-11 w-11 flex-shrink-0 items-center justify-center">
      <input ref={ref} type="checkbox" aria-label={label} data-check={testId} checked={checked} onChange={e => onChange(e.target.checked)}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <span aria-hidden className="h-5 w-5 rounded-[var(--kin-bo-sm)] border-2 border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] peer-checked:border-[var(--kin-nhan-nen)] peer-checked:bg-[var(--kin-nhan-nen)] peer-indeterminate:border-[var(--kin-nhan-nen)] peer-indeterminate:bg-[var(--kin-nhan-nen)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--kin-nhan-link)]" />
      <span aria-hidden className="pointer-events-none absolute text-[length:var(--kin-co-caption)] font-bold leading-none text-[var(--kin-nhan-chu-tren-nen)] opacity-0 peer-checked:opacity-100">✓</span>
      <span aria-hidden className="pointer-events-none absolute text-[length:var(--kin-co-caption)] font-bold leading-none text-[var(--kin-nhan-chu-tren-nen)] opacity-0 peer-indeterminate:opacity-100">–</span>
    </label>
  );
}

/** Dải báo lỗi tải: role="status" + data-loi (không role="alert" trần), kèm Thử lại. */
export function QueueErrorStrip({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="status" data-loi className="flex items-center gap-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nhan-nen-nhat)] px-4 py-2">
      <span aria-hidden className="inline-block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[var(--kin-tt-chu-loi)]" />
      <span className="flex-1 font-semibold text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{message}</span>
      <button type="button" onClick={onRetry} className="min-h-11 px-3 font-semibold text-[var(--kin-nhan-link)] hover:underline">Thử lại</button>
    </div>
  );
}

export function QueueSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải hàng chờ" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="kin-m flex min-h-[72px] flex-col gap-2 border-b border-[var(--kin-vien-nhat)] py-3">
          <div className="kin-skel kin-skel--lo h-[13px] w-3/4 rounded" />
          <div className="kin-skel kin-skel--lo h-[13px] w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
