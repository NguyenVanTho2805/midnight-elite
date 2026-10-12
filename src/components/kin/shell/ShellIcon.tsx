// Biểu tượng của thanh module (Figma "Icon/…" 21×21). Vẽ lại bằng nét đơn giản, màu theo chữ (currentColor) nên đổi theo
// trạng thái chọn / chủ đề. File SVG gốc trong Figma không tải được từ môi trường dựng (tường lửa chặn figma.com).
import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  // phiếu việc có dấu tick
  viec: <><rect x="4.5" y="3.5" width="13" height="16" rx="2" /><path d="M8 8.5h6M8 12h6M8 15.5h3.5" /></>,
  lich: <><rect x="3.5" y="5" width="15" height="14" rx="2" /><path d="M3.5 9.5h15M7.5 3v4M14.5 3v4" /></>,
  lop: <><rect x="4" y="3.5" width="14" height="16" rx="2" /><path d="M8 3.5v16M11 8h4M11 11.5h4" /></>,
  "thu-vien": <><path d="M3.5 7.5a2 2 0 0 1 2-2h3.7l1.8 2h5.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" /></>,
  khac: <><circle cx="5.5" cy="11.5" r="1.4" /><circle cx="11" cy="11.5" r="1.4" /><circle cx="16.5" cy="11.5" r="1.4" /></>,
  nguoi: <><circle cx="8" cy="8" r="3" /><path d="M2.5 18.5c.4-3.2 2.7-5 5.5-5s5.1 1.8 5.5 5" /><circle cx="15.5" cy="8.5" r="2.4" /><path d="M16 13.7c2.2.3 3.5 1.9 3.8 4.3" /></>,
  "kiem-duyet": <><path d="M11 3 4.5 5.7v5c0 4 2.7 7 6.5 8.3 3.8-1.3 6.5-4.3 6.5-8.3v-5z" /><path d="m8.2 11.3 2.1 2.1 3.7-3.9" /></>,
  "bao-cao": <><path d="M4 19h14" /><rect x="5.5" y="11" width="2.8" height="6" rx=".6" /><rect x="9.6" y="6.5" width="2.8" height="10.5" rx=".6" /><rect x="13.7" y="9" width="2.8" height="8" rx=".6" /></>,
  "hoc-phi": <><rect x="3" y="5.5" width="16" height="11.5" rx="2" /><path d="M3 9.5h16M6.5 14h3" /></>,
  "cai-dat": <><circle cx="11" cy="11" r="2.8" /><path d="M11 3.5v2.2M11 16.3v2.2M18.5 11h-2.2M5.7 11H3.5M16.3 5.7l-1.6 1.6M7.3 14.7l-1.6 1.6M16.3 16.3l-1.6-1.6M7.3 7.3 5.7 5.7" /></>,
  "hop-thu": <><rect x="3" y="5.5" width="16" height="11.5" rx="2" /><path d="m3.5 7 7.5 5.5L18.5 7" /></>,
  "bai-kt": <><rect x="4.5" y="3.5" width="13" height="16" rx="2" /><path d="m8 11 2 2 4-4.5M8 16h6" /></>,
};

export type ShellIconName = keyof typeof P;

export function ShellIcon({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {P[name] ?? P.viec}
    </svg>
  );
}
