// BU-06 — thanh tab hồ sơ dạng LIÊN KẾT (?tab=): chạy cả khi chưa nạp JS, chia sẻ được. Dải tab cuộn ngang được ở 390px, mỗi tab ≥ 44px.
"use client";
import Link from "next/link";
import { KIN_TAB_BOX, KinTabInner } from "@/components/kin/Tabs";
import { TAB_HO_SO, type TabHoSoKey } from "./tab";

export function TabHoSo({ tutorId, active }: { tutorId: string; active: TabHoSoKey }) {
  return (
    <div role="tablist" aria-label="Nội dung hồ sơ" className="-mx-5 flex overflow-x-auto border-b border-[var(--kin-vien-thuong)] px-5 sm:mx-0 sm:px-0">
      {TAB_HO_SO.map(t => (
        <Link key={t.key} role="tab" aria-selected={t.key === active} id={`tab-${t.key}`} aria-controls="khung-tab-ho-so" scroll={false}
          href={`/mentor/${tutorId}?tab=${t.key}`} className={KIN_TAB_BOX}>
          <KinTabInner active={t.key === active}>{t.label}</KinTabInner>
        </Link>
      ))}
    </div>
  );
}
