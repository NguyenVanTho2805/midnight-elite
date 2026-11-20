// TB-LOP (17/11/2026) — MỘT tin "Thông báo lớp", dùng chung cho trang gia sư (…/quan-lop/<id>/thong-bao) và tab Thông báo của học sinh.
// Không "use client": hiện được ở cả Server Component. Nội dung là chữ thuần (React tự thoát HTML), link http/https thành <a> mở tab mới (rel noopener noreferrer).
// `actions` = chỗ gia sư đặt nút Ghim / Gỡ; học sinh không có.
import type { ReactNode } from "react";
import { announceTime, linkParts } from "@/lib/classAnnouncement";

export interface ThongBaoItem { id: string; body: string; pinned: boolean; createdAt: string }

export function ThongBaoTin({ item, now, actions }: { item: ThongBaoItem; now?: Date; actions?: ReactNode }) {
  return (
    <article data-thong-bao={item.id} data-ghim={item.pinned ? "1" : undefined} aria-label={item.pinned ? "Thông báo đã ghim" : "Thông báo"}
      className="min-w-0 rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-[var(--kin-kc-7)] py-[var(--kin-kc-6)]">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
        {item.pinned && <span className="font-semibold text-[var(--kin-chu-chinh)]">Đã ghim</span>}
        <time dateTime={item.createdAt}>{announceTime(item.createdAt, now)}</time>
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">
        {linkParts(item.body).map((p, i) => p.kind === "link"
          ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all text-[var(--kin-nhan-link)]">{p.text}</a>
          : <span key={i}>{p.text}</span>)}
      </p>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
