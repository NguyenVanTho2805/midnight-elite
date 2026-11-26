"use client";
// Thanh bên: 72px thu gọn (640–1023px), 240px (≥ 1024px). Ẩn dưới 640px (thay bằng thanh dưới).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTrang } from "../bieu-tuong";
import { dangMo, MUC, type ThongTinKhung } from "./muc-dieu-huong";
import { NutDangXuat } from "./dang-xuat";

export function ThanhBen({ chu, soDon, soHs, ten, vaiNhan }: ThongTinKhung) {
  const path = usePathname();
  return (
    <nav aria-label="Điều hướng chính" className="sticky top-0 z-30 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-border bg-sidebar sm:flex lg:w-60">
      <Link href="/quan-ly" className="flex h-16 items-center justify-center gap-2 px-3 font-extrabold text-text lg:justify-start lg:px-5">
        <IconTrang className="text-gold" />
        <span className="hidden leading-tight lg:block">BCA <span className="font-semibold text-text-2">Midnight</span></span>
        <span className="sr-only lg:hidden">BCA Midnight — Hôm nay</span>
      </Link>
      <ul className="flex flex-1 flex-col gap-1 px-2 pt-2 lg:px-3">
        {MUC.filter((m) => chu || !m.chiChu).map(({ href, nhan, Icon }) => {
          const mo = dangMo(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={mo ? "page" : undefined}
                className={`nhan relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1.5 text-[12px] font-semibold lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${mo ? "bg-nav-active text-text" : "text-text-2 hover:bg-row-hover hover:text-text"}`}
              >
                {mo ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gold" /> : null}
                <Icon size={20} className={mo ? "text-gold" : ""} />
                <span className="lg:flex-1">{nhan}</span>
                {href === "/quan-ly/don" && soDon > 0 ? (
                  <span className="so absolute right-1 top-1 min-w-5 rounded-full bg-gold px-1.5 text-center text-[12px] font-semibold text-on-gold lg:static" aria-label={`${soDon} đơn mới`}>{soDon}</span>
                ) : null}
                {href === "/quan-ly/hoc-sinh" ? <span className="so hidden text-[13px] font-normal text-text-3 lg:inline" aria-label={`${soHs} hồ sơ`}>{soHs}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border p-2 lg:p-3">
        <p className="hidden px-3 py-2 lg:block">
          <span className="block font-semibold text-text" translate="no">{ten}</span>
          <span className="block text-[13px] text-text-3">{vaiNhan}</span>
        </p>
        <NutDangXuat className="justify-center lg:justify-start [&>span]:hidden lg:[&>span]:inline" />
      </div>
    </nav>
  );
}
