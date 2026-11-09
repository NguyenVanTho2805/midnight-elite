// GS-LOP-GON (09/11/2026) — dải MỤC CON bên trong tab Học sinh / tab Cài đặt của lớp (?muc=). KHÔNG phải một dải tab thứ hai của lớp: nhỏ hơn, dạng viên thuốc, aria-label riêng
// ("Mục của Học sinh"), nên trang vẫn đúng MỘT nav "Trang của Quản lớp". Là điều hướng (Link + aria-current) để URL ổn định và e2e `waitForURL` được; cuộn ngang ở điện thoại.
"use client";
import Link from "next/link";

export interface MucItem { key: string; label: string; href: string; active: boolean }

export default function MucNav({ label, items }: { label: string; items: MucItem[] }) {
  return (
    <nav aria-label={label} data-muc-nav className="mb-6 -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
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
