// Khung phòng thi: thanh Navy cố định (tên đề + Câu N/M | đồng hồ | chip lưu), dải phụ, cột câu hỏi 680px ở giữa, bảng số câu bên phải (≥1024),
// chân trang cố định. Toàn màn hình, trang không cuộn; chỉ thân cuộn (đồng hồ không đổi vị trí khi cuộn). KHÔNG có vỏ module (phòng thi khoá).
// Điện thoại: một cột tràn lề 16px; bảng số câu thành tờ trượt do TakingRoom dựng.
"use client";
import type { ReactNode } from "react";

export interface RoomLayoutProps {
  title: ReactNode; counter: ReactNode; clock: ReactNode; chip: ReactNode;
  strip?: ReactNode; subBar?: ReactNode; aside: ReactNode; footer: ReactNode; sheet?: ReactNode;
  /** Ref gọi lại cho thân cuộn (để TakingRoom theo dõi câu đang xem). */
  scrollBox: (el: HTMLDivElement | null) => void; children: ReactNode;
}

export default function RoomLayout({ title, counter, clock, chip, strip, subBar, aside, footer, sheet, scrollBox, children }: RoomLayoutProps) {
  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--kin-nen-trang)]" data-phong-thi-khung>
      <header className="flex-shrink-0 text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-th-navy)" }}>
        <div className="mx-auto max-w-[1100px] grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 min-h-[52px] lg:min-h-14">
          <div className="order-1 lg:order-2">{clock}</div>
          <div className="order-2 lg:order-1 min-w-0 flex flex-col items-center lg:items-start">{title}{counter}</div>
          <div className="order-3">{chip}</div>
        </div>
      </header>
      {strip}
      {subBar}
      <div ref={scrollBox} className="flex-1 min-h-0 overflow-y-auto" data-thanh-cuon>
        <div className="mx-auto grid justify-center gap-6 px-4 py-5 lg:grid-cols-[minmax(0,680px)_264px]">
          <div className="min-w-0 flex flex-col gap-4" data-cot-cau-hoi>{children}</div>
          <aside aria-label="Bảng số câu" className="hidden lg:block sticky top-5 self-start" data-bang-so-cau>{aside}</aside>
        </div>
      </div>
      {footer}
      {sheet}
    </div>
  );
}
