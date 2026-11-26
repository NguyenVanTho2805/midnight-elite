// Chip có chữ, cho xuống dòng, không cắt (khung-quan-ly §6).
import type { ReactNode } from "react";

const MAU = {
  ok: "bg-ok-bg text-ok",
  thu: "bg-trial-bg text-trial-fg",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  phep: "bg-excused-bg text-excused",
  mo: "border border-border text-text-3",
  trung: "bg-raised text-text-2",
} as const;
export type MauChip = keyof typeof MAU;

export function Chip({ mau = "trung", children, className = "" }: { mau?: MauChip; children: ReactNode; className?: string }) {
  return <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5 whitespace-normal ${MAU[mau]} ${className}`}>{children}</span>;
}

/** "Thử · còn 9 ngày"; ≤ 3 ngày đổi màu warn; đã hết → danger. */
export function TrialChip({ con, het, tienTo = "Thử · " }: { con?: number | null; het?: string | null; tienTo?: string }) {
  if (het) return <Chip mau="danger">Hết thử {het}</Chip>;
  if (con === null || con === undefined) return null;
  return <Chip mau={con <= 3 ? "warn" : "thu"}>{tienTo}{con === 0 ? "hết hôm nay" : `còn ${con} ngày`}</Chip>;
}

/** Chip môn theo loại: "Toán · chính thức" / "Toán · thử" / "Toán · nghỉ". */
export function MonChip({ ten, o }: { ten: string; o: "hoc" | "thu" | "nghi" | null }) {
  if (!o) return null;
  return <Chip mau={o === "hoc" ? "ok" : o === "thu" ? "thu" : "mo"}>{ten} · {o === "hoc" ? "chính thức" : o === "thu" ? "thử" : "nghỉ"}</Chip>;
}
