// GS-LOP-GON (09/11/2026) — đầu phần cho trang con NẰM TRONG khung lớp (đầu lớp ClassHead đã có h1 = tên lớp, dải tab đã nói đang ở tab nào). Trang con không được có h1 thứ hai
// và không lặp tên tab thành tiêu đề, nên chỉ còn: một dòng mô tả (tuỳ chọn) bên trái, nút thao tác bên phải; có `title` thì là h2 (vd. tên bài khi xem thử), `back` là liên kết nhỏ.
import Link from "next/link";
import type { ReactNode } from "react";

export default function EmbeddedHead({ title, sub, actions, back }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  if (title == null && sub == null && actions == null && !back) return null;
  return (
    <div data-embedded-head className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {back && <Link href={back.href} className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:underline">{back.label}</Link>}
        {title != null && <h2 className="break-words text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{title}</h2>}
        {sub != null && <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{sub}</p>}
      </div>
      {actions != null && <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0">{actions}</div>}
    </div>
  );
}
