"use client";
// Dải mất mạng (warn-bg, 40px, dưới đầu trang) + hộp thoại phiên hết. Thay đổi chờ không bị mất.
import { useEffect } from "react";
import { khoiDongHangDoi, thuLai, useHangDoi } from "./hang-doi";
import { ToTruot } from "../ui/to-truot";
import { nutChinh, nutPhu } from "../ui/nut";

export function MatMang() {
  const t = useHangDoi();
  useEffect(() => khoiDongHangDoi(), []);
  return (
    <>
      <div aria-live="polite" className="fixed inset-x-0 top-14 z-20 sm:left-[72px] sm:top-16 lg:left-60">
        {t.matMang ? (
          <p className="dai-mat-mang flex h-10 items-center whitespace-nowrap overflow-hidden bg-warn-bg px-4 py-2 text-[14px] text-text sm:px-6 lg:px-8">
            <span className="sm:hidden">Mất mạng · tự gửi khi có mạng.</span>
            <span className="hidden sm:inline">Đang mất mạng — thay đổi được giữ trên máy và tự gửi khi có mạng.</span>
            {t.cho > 0 ? <span className="so ml-1 font-semibold">{t.cho}<span className="hidden sm:inline"> thay đổi</span> chưa gửi.</span> : null}
          </p>
        ) : null}
      </div>
      <ToTruot mo={t.hetPhien} dong={() => {}} tieuDe="Phiên đăng nhập đã hết">
        <p className="text-text-2">Đăng nhập lại để lưu tiếp.{t.cho > 0 ? ` ${t.cho} thay đổi đang chờ vẫn được giữ trên máy này.` : ""}</p>
        <a href="/dang-nhap" target="_blank" rel="noopener" className={`${nutChinh} mt-4 w-full`}>Đăng nhập lại (mở thẻ mới)</a>
        <button type="button" onClick={thuLai} className={`${nutPhu} mt-3 w-full`}>Đã đăng nhập lại — gửi tiếp</button>
      </ToTruot>
    </>
  );
}
