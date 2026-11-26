// Trạng thái chung: trống, lỗi, chờ tải (khung-quan-ly §4). Không có quyền: app/(quan-ly)/quan-ly/forbidden.tsx.
import Link from "next/link";
import type { ReactNode } from "react";

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

