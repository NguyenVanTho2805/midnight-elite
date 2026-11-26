// Trạng thái chung: trống, lỗi, chờ tải, không có quyền (khung-quan-ly §4).
import Link from "next/link";
import type { ReactNode } from "react";
import { nutPhu } from "./nut";

export function Trong({ children, hanhDong }: { children: ReactNode; hanhDong?: { href: string; nhan: string } }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">
      <p>{children}</p>
      {hanhDong ? <Link href={hanhDong.href} className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold underline-offset-4 hover:underline">{hanhDong.nhan}</Link> : null}
    </div>
  );
}

export function DaiLoi({ children, thuLai }: { children: ReactNode; thuLai?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-danger-bg px-4 py-3 text-text">
      <p>{children}</p>
      {thuLai}
    </div>
  );
}

/** Khối chờ tải đúng hình nội dung thật, không vệt sáng chạy; hiện sau 300ms. */
export function Khoi({ className = "" }: { className?: string }) {
  return <div className={`rounded-[14px] bg-skeleton ${className}`} />;
}
export function ChoTai({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" className="cho-tai">
      <span className="sr-only">Đang tải…</span>
      {children}
    </div>
  );
}

export function KhongCoQuyen({ thongDiep = "Mục này chỉ chủ lớp xem được." }: { thongDiep?: string }) {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-extrabold lg:text-[28px]">Không có quyền</h1>
      <p className="mt-2 text-text-2">{thongDiep}</p>
      <Link href="/quan-ly" className={`${nutPhu} mt-4`}>Về Hôm nay</Link>
    </div>
  );
}
