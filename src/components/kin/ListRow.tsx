// Dòng danh sách (Figma "Cần cô xử lý", "Cần làm"): tiêu đề, dòng phụ, dòng trạng thái (KinStatus) bên trái; mốc giờ hoặc nút hành động bên phải.
// Không khung, không nền: kẻ mảnh ở đáy. Có `href` thì cả dòng là liên kết (vùng chạm ≥ 44px).
import Link from "next/link";
import type { ReactNode } from "react";

export interface KinListRowProps {
  title: ReactNode;
  /** Dòng phụ xám 14px (nhiều dòng thì truyền mảng). */
  sub?: ReactNode;
  /** Dòng trạng thái: thường là <KinStatus> hoặc chữ hành động màu cam. */
  status?: ReactNode;
  /** Bên phải: mốc giờ (chữ nhỏ) hoặc <KinButton variant="secondary">. */
  trailing?: ReactNode;
  href?: string;
  className?: string;
}

export function KinListRow({ title, sub, status, trailing, href, className = "" }: KinListRowProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">{title}</p>
        {sub && <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{sub}</p>}
        {status && <div className="mt-1.5 text-[length:var(--kin-co-goc)]">{status}</div>}
      </div>
      {trailing != null && <div className="flex-shrink-0 self-start text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)] tabular-nums">{trailing}</div>}
    </>
  );
  const cls = `flex items-start justify-between gap-4 py-[var(--kin-kc-6)] px-[var(--kin-kc-6)] min-h-[var(--kin-cham-toi-thieu)] border-b border-[var(--kin-vien-nhat)] ${className}`;
  return href
    ? <Link href={href} data-kin-list-row className={`${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{body}</Link>
    : <div data-kin-list-row className={cls}>{body}</div>;
}
