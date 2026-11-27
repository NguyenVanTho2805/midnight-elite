"use client";
// Hộp "Việc cần làm" chia tab (QĐ 27, bước 3): mỗi lúc chỉ hiện một loại việc để Hôm nay gọn trong một màn.
// Mở sẵn tab đầu tiên còn việc. Nội dung từng tab do máy chủ dựng sẵn và truyền vào.
// shortcut: tab là nút thường (Tab/Enter), chưa có mũi tên trái/phải theo mẫu WAI-ARIA; thêm nếu có người dùng bàn phím phàn nàn.
import { useState, type ReactNode } from "react";

export type TabViec = { id: string; nhan: string; so: number; noiDung: ReactNode };

export function TabViecCanLam({ tabs }: { tabs: TabViec[] }) {
  const [chon, setChon] = useState(() => (tabs.find((t) => t.so > 0) ?? tabs[0])?.id);
  const dang = tabs.find((t) => t.id === chon) ?? tabs[0];
  if (!dang) return null;
  return (
    <div className="min-w-0 rounded-[14px] border border-border bg-surface">
      <div role="tablist" aria-label="Loại việc" className="flex overflow-x-auto border-b border-border px-1">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" id={`tab-viec-${t.id}`} aria-selected={t.id === dang.id} aria-controls="khung-viec"
            onClick={() => setChon(t.id)}
            className={`nhan -mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[15px] font-semibold ${t.id === dang.id ? "border-gold text-text" : "border-transparent text-text-2 hover:text-text"}`}
          >
            {t.nhan} <span className={`so ${t.so > 0 ? "text-warn" : "text-text-3"}`}>{t.so}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="khung-viec" aria-labelledby={`tab-viec-${dang.id}`}>{dang.noiDung}</div>
    </div>
  );
}
