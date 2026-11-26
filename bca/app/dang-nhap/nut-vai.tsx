"use client";
import { useState } from "react";

export function NutVai({ vai, ten }: { vai: string; ten: string }) {
  const [loi, setLoi] = useState("");
  return (
    <div>
      <button
        className="min-h-12 w-full rounded-[14px] border border-border-input bg-surface px-4 text-left font-semibold hover:bg-raised"
        onClick={async () => {
          const r = await fetch("/api/dev/dang-nhap", { method: "POST", body: JSON.stringify({ vai }) });
          if (r.ok) location.href = "/";
          else setLoi((await r.json().catch(() => ({}))).loi ?? `Lỗi ${r.status}`);
        }}
      >
        {ten}
      </button>
      {loi && <p className="mt-1 text-sm text-danger">{loi}</p>}
    </div>
  );
}
