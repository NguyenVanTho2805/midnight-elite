// Đồng hồ (giờ MÁY CHỦ, không đổi vị trí khi cuộn) + chip lưu. aria-live chỉ ở mốc 5 phút / 1 phút, không đọc mỗi giây.
"use client";
import { formatClock, lowTimeAnnouncement, spokenClock } from "@/lib/examRoom";
import type { ChipView } from "./useSaveQueue";

export function Clock({ remainingSec, caption }: { remainingSec: number; caption: string }) {
  return (
    <div className="text-center leading-tight">
      <p role="timer" aria-label={`Còn lại ${spokenClock(remainingSec)}`} data-dong-ho
        className="font-mono font-semibold text-[length:var(--kin-co-h2)] tabular-nums tracking-[0.04em]"
        style={remainingSec < 60 ? { color: "var(--kin-tt-nen-loi)" } : undefined}>{formatClock(remainingSec)}</p>
      <p className="text-[length:var(--kin-co-caption)] opacity-80">{caption}</p>
      <p className="sr-only" role="status">{lowTimeAnnouncement(remainingSec)}</p>
    </div>
  );
}

/** Chip lưu: chữ + biểu tượng, không chỉ màu. "Chưa lưu được" có nút Thử lại (nền cảnh báo). */
export function SaveChipView({ chip, onRetry }: { chip: ChipView; onRetry: () => void }) {
  const label = chip.label;
  const failed = chip.status === "failed";
  return (
    <div role="status" data-chip-luu={chip.status} className="flex flex-col items-end lg:flex-row lg:items-center lg:justify-end gap-0 lg:gap-2 min-h-[28px] text-[length:var(--kin-co-caption)] font-semibold">
      {label && (
        <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-[var(--kin-bo-tron)]"
          style={failed ? { background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-phu)" }}>
          <span aria-hidden>{failed ? "⚠" : chip.status === "saved" ? "✓" : "…"}</span>{label}
        </span>
      )}
      {failed && (
        <button type="button" onClick={onRetry} className="min-h-[44px] px-2 underline underline-offset-2 text-[var(--kin-chu-tren-nut-chinh)] whitespace-nowrap">Thử lại</button>
      )}
    </div>
  );
}
