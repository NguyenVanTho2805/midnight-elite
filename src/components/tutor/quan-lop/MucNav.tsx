// GS-LOP-GON (09/11/2026) — dải MỤC CON bên trong tab Học sinh / tab Cài đặt của lớp (?muc=). KHÔNG phải một dải tab thứ hai của lớp: nhỏ hơn, dạng viên thuốc, aria-label riêng
// ("Mục của Học sinh"), nên trang vẫn đúng MỘT nav "Trang của Quản lớp". Là điều hướng (Link + aria-current) để URL ổn định và e2e `waitForURL` được; cuộn ngang ở điện thoại.
// DG-HOC-ONLINE (14/11/2026): mục đang chọn nằm khuất bên phải dải (vd "Học online" ở 390px) ⇒ chỉ cuộn NGANG dải để mục đó hiện trọn
// (đặt scrollLeft của chính dải, không dùng scrollIntoView nên trang không bị kéo lên / xuống). Mục đã hiện trọn thì không cuộn gì.
"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

export interface MucItem { key: string; label: string; href: string; active: boolean }

export default function MucNav({ label, items }: { label: string; items: MucItem[] }) {
  const navRef = useRef<HTMLElement>(null);
  const activeKey = items.find(m => m.active)?.key ?? null;
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !activeKey || nav.scrollWidth <= nav.clientWidth) return;
    const el = nav.querySelector<HTMLElement>(`[data-muc="${CSS.escape(activeKey)}"]`);
    if (!el) return;
    const left = el.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft, right = left + el.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = Math.max(0, left - 8);
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 8;
  }, [activeKey]);
  return (
    <nav ref={navRef} aria-label={label} data-muc-nav className="mb-6 -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
      {items.map(m => (
        <Link key={m.key} href={m.href} aria-current={m.active ? "page" : undefined} data-muc={m.key}
          className={`inline-flex items-center min-h-11 px-4 rounded-full border whitespace-nowrap text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${
            m.active
              ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)] font-medium text-[var(--kin-chu-chinh)]"
              : "border-[var(--kin-vien-thuong)] text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]"
          }`}>
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
