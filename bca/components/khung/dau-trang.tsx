// Đầu trang dính: 56px (điện thoại) / 64px (máy tính); nút quay lại 44×44 ở màn con.
import Link from "next/link";
import type { ReactNode } from "react";
import { IconQuayLai } from "../bieu-tuong";
import { nutBieuTuong } from "../ui/nut";

export function DauTrang({ tieuDe, quayLai, phu, children }: { tieuDe: ReactNode; quayLai?: { href: string; nhan: string }; phu?: ReactNode; children?: ReactNode }) {
  return (
    <header className="bong-dinh sticky top-0 z-20 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        {quayLai ? (
          <Link href={quayLai.href} className={`${nutBieuTuong} -ml-3`} aria-label={quayLai.nhan}><IconQuayLai /></Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold sm:text-xl">
            {tieuDe}
            {phu ? <span className="so ml-2 hidden font-normal text-text-3 sm:inline">· {phu}</span> : null}
          </p>
        </div>
        {children}
        {phu ? <span className="so shrink-0 text-[13px] text-text-3 sm:hidden">{phu}</span> : null}
      </div>
    </header>
  );
}

/** Khung nội dung: tối đa 1120px, lề 16 / 24 / 32. */
export function NoiDung({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1120px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6 ${className}`}>{children}</div>;
}
