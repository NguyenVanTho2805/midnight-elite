"use client";
// Thanh dưới điện thoại (< 640px): đúng 5 mục Hôm nay · Điểm danh · Học sinh · Buổi học · Thêm (T22).
// Ẩn ở màn điểm danh một buổi và khi bàn phím ảo mở. "Điểm danh" mở thẳng buổi tối nay trong khung giờ (T24).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconDon, IconTaiKhoan, IconThem } from "../bieu-tuong";
import { ToTruot } from "../ui/to-truot";
import { NutDangXuat } from "./dang-xuat";
import { NutDoiGiaoDien } from "./doi-giao-dien";
import { dangMo, MUC, type ThongTinKhung } from "./muc-dieu-huong";

function useBanPhimMo() {
  const [mo, setMo] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setMo(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", f);
    return () => vv.removeEventListener("resize", f);
  }, []);
  return mo;
}

export function ThanhDuoi({ chu, soDon, ten, vaiNhan }: ThongTinKhung) {
  const path = usePathname();
  const [them, setThem] = useState(false);
  const banPhim = useBanPhimMo();
  if (/^\/quan-ly\/diem-danh\/\d+/.test(path) || banPhim) return null;
  const o = "nhan flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold";
  const themDangMo = path.startsWith("/quan-ly/don") || path.startsWith("/quan-ly/tai-khoan");
  return (
    <>
      <nav aria-label="Điều hướng chính" className="day-an-toan fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar sm:hidden">
        <ul className="flex">
          {MUC.filter((m) => !m.chiChu).map(({ href, nhan, Icon }) => {
            const mo = dangMo(path, href);
            return (
              <li key={href} className="flex flex-1">
                <Link href={href === "/quan-ly/diem-danh" ? "/quan-ly/diem-danh?mo=toi-nay" : href} aria-current={mo ? "page" : undefined} className={`${o} ${mo ? "text-gold" : "text-text-2"}`}>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full ${mo ? "bg-nav-active" : ""}`}><Icon /></span>
                  {nhan}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button type="button" onClick={() => setThem(true)} aria-label={chu && soDon > 0 ? `Thêm, ${soDon} đơn mới` : "Thêm"} className={`${o} ${themDangMo ? "text-gold" : "text-text-2"}`}>
              <span className={`relative flex h-8 w-14 items-center justify-center rounded-full ${themDangMo ? "bg-nav-active" : ""}`}>
                <IconThem />
                {chu && soDon > 0 ? <span aria-hidden="true" className="absolute right-3 top-1 size-2 rounded-full bg-gold" /> : null}
              </span>
              Thêm
            </button>
          </li>
        </ul>
      </nav>
      <ToTruot mo={them} dong={() => setThem(false)} tieuDe="Thêm">
        <ul className="grid gap-1">
          {chu ? (
            <li>
              <Link href="/quan-ly/don" onClick={() => setThem(false)} className="nhan flex min-h-12 items-center gap-3 rounded-[10px] px-3 hover:bg-row-hover">
                <IconDon size={20} />
                <span className="flex-1">Đơn đăng ký</span>
                {soDon > 0 ? <span className="so rounded-full bg-gold px-2 text-[13px] font-semibold text-on-gold">{soDon}</span> : null}
              </Link>
            </li>
          ) : null}
          {chu ? (
            <li>
              <Link href="/quan-ly/tai-khoan" onClick={() => setThem(false)} className="nhan flex min-h-12 items-center gap-3 rounded-[10px] px-3 hover:bg-row-hover">
                <IconTaiKhoan size={20} />
                <span className="flex-1">Tài khoản giáo viên</span>
              </Link>
            </li>
          ) : null}
          <li className="flex min-h-12 items-center gap-3 px-3 text-text-2">
            <IconTaiKhoan size={20} />
            <span><span className="font-semibold text-text" translate="no">{ten}</span> · {vaiNhan}</span>
          </li>
          <li><NutDoiGiaoDien coNhan className="min-h-12 w-full justify-start" /></li>
          <li><NutDangXuat className="min-h-12" /></li>
        </ul>
      </ToTruot>
    </>
  );
}
