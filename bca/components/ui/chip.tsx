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

/** liền: không xuống dòng trong chip (ô bảng hẹp, chip ngắn như "còn 8 ngày"). */
export function Chip({ mau = "trung", children, className = "", lien = false, gon = false }: { mau?: MauChip; children: ReactNode; className?: string; lien?: boolean; gon?: boolean }) {
  return <span className={`inline-flex max-w-full items-center rounded-full px-2.5 ${gon ? "py-0" : "py-0.5"} text-[13px] font-semibold leading-5 ${lien ? "whitespace-nowrap" : "whitespace-normal"} ${MAU[mau]} ${className}`}>{children}</span>;
}

/** "Thử · còn 9 ngày"; ≤ 3 ngày đổi màu warn; đã hết → danger. */
export function TrialChip({ con, het, tienTo = "Thử · ", lien = false, gon = false }: { con?: number | null; het?: string | null; tienTo?: string; lien?: boolean; gon?: boolean }) {
  if (het) return <Chip mau="danger" lien={lien} gon={gon}>Hết thử {het}</Chip>;
  if (con === null || con === undefined) return null;
  return <Chip mau={con <= 3 ? "warn" : "thu"} lien={lien} gon={gon}>{tienTo}{con === 0 ? "hết hôm nay" : `còn ${con} ngày`}</Chip>;
}

/** Chip môn theo loại: "Toán · chính thức" / "Toán · thử" / "Toán · nghỉ". */
/** gon: chip thấp 20px cho ô bảng (2 dòng chip vẫn ≤ 56px). */
export function MonChip({ ten, o, gon = false }: { ten: string; o: "hoc" | "thu" | "nghi" | null; gon?: boolean }) {
  if (!o) return null;
  return <Chip gon={gon} mau={o === "hoc" ? "ok" : o === "thu" ? "thu" : "mo"}>{ten} · {o === "hoc" ? "chính thức" : o === "thu" ? "thử" : "nghỉ"}</Chip>;
}
