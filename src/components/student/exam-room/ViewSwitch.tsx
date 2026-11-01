// "Từng câu / Cả đề" — hai nút tab 44px. Luyện tập không có công tắc này (luôn từng câu).
"use client";
import type { RoomView as ViewMode } from "@/lib/examRoomLib";

const OPTS: { v: ViewMode; label: string }[] = [{ v: "per-question", label: "Từng câu" }, { v: "whole", label: "Cả đề" }];

export default function ViewSwitch({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="tablist" aria-label="Cách xem đề" className="inline-flex rounded-[var(--kin-bo-md)] overflow-hidden" style={{ border: "1px solid var(--kin-vien-o-nhap)" }}>
      {OPTS.map(o => (
        <button key={o.v} type="button" role="tab" aria-selected={value === o.v} onClick={() => onChange(o.v)}
          className="min-h-[44px] px-4 text-[length:var(--kin-co-small)] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]"
          style={value === o.v ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-mo)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
