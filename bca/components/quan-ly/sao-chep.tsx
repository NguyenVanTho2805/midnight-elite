"use client";
import { useState } from "react";

export function SaoChep({ chu }: { chu: string }) {
  const [xong, setXong] = useState(false);
  return (
    <button
      type="button"
      className="nhan inline-flex min-h-11 items-center rounded-[10px] border border-border-input px-3 text-[13px] font-semibold hover:bg-row-hover"
      onClick={async () => {
        await navigator.clipboard?.writeText(chu);
        setXong(true);
        setTimeout(() => setXong(false), 2000);
      }}
    >
      <span aria-live="polite">{xong ? "Đã sao chép" : "Sao chép"}</span>
    </button>
  );
}
