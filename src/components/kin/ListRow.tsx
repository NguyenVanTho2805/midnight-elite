// Dòng danh sách (Figma "Cần cô xử lý", "Cần làm"): tiêu đề, dòng phụ, dòng trạng thái (KinStatus) bên trái; mốc giờ hoặc nút hành động bên phải.
// Không khung, không nền: kẻ mảnh ở đáy. Có `href` thì cả dòng là liên kết (vùng chạm ≥ 44px).
// SCL-G-0 (QUYET-DINH-GIAO-DIEN §3.1 mục 5, §3.3): tiêu đề tiếng Việt XUỐNG DÒNG, không bao giờ cắt "…" (từ quá dài thì bẻ giữa từ, không tràn 360px);
// `aside` = cột phải căn giữa dòng (vd. "Nộp 4/12" + KinStatus, điểm "8,5/10"); `current` = hàng đang chọn (nền nhạt + aria-current);
// `size="lg"` = hàng 56px của trang lớp (tiêu đề 16px, dòng phụ 14px màu --kin-chu-phu).
import Link from "next/link";
import type { ReactNode } from "react";

export interface KinListRowProps {
  title: ReactNode;
  /** Dòng phụ 14px (nhiều dòng thì truyền mảng). */
  sub?: ReactNode;
  /** Dòng trạng thái: thường là <KinStatus> hoặc chữ hành động màu cam. */
  status?: ReactNode;
  /** Cột phải, căn giữa theo chiều dọc, chữ 14px --kin-chu-phu: số liệu, KinStatus, điểm. Đứng trước `trailing`. */
  aside?: ReactNode;
  /** Bên phải, sát trên: mốc giờ (chữ nhỏ) hoặc <KinButton variant="secondary">. */
  trailing?: ReactNode;
  href?: string;
  /** Hàng đang chọn (ngăn sửa bên cạnh đang mở hàng này). */
  current?: boolean;
  size?: "md" | "lg";
  className?: string;
}

export function KinListRow({ title, sub, status, aside, trailing, href, current, size = "md", className = "" }: KinListRowProps) {
  const lg = size === "lg";
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p data-kin-list-title className={`[overflow-wrap:anywhere] text-[var(--kin-chu-chinh)] ${lg ? "text-[length:var(--kin-co-body)] leading-6 font-medium" : "text-[length:var(--kin-co-goc)] leading-5"}`}>{title}</p>
        {sub && <p className={`mt-1 [overflow-wrap:anywhere] text-[length:var(--kin-co-goc)] leading-5 ${lg ? "text-[var(--kin-chu-phu)]" : "text-[var(--kin-chu-mo)]"}`}>{sub}</p>}
        {status && <div className="mt-1.5 text-[length:var(--kin-co-goc)]">{status}</div>}
      </div>
      {aside != null && <div data-kin-list-aside className="flex-shrink-0 self-center flex flex-wrap items-center justify-end gap-x-[var(--kin-kc-5)] gap-y-1 max-w-[50%] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] tabular-nums">{aside}</div>}
      {trailing != null && <div className="flex-shrink-0 self-start text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)] tabular-nums">{trailing}</div>}
    </>
  );
  const cls = `flex items-start justify-between gap-4 px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] ${lg ? "py-[var(--kin-kc-4)] min-h-14" : "py-[var(--kin-kc-6)] min-h-[var(--kin-cham-toi-thieu)]"} ${current ? "bg-[var(--kin-nen-dang-chon)]" : ""} ${className}`;
  const aria = current ? { "aria-current": "true" as const } : {};
  return href
    ? <Link href={href} data-kin-list-row {...aria} className={`${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{body}</Link>
    : <div data-kin-list-row {...aria} className={cls}>{body}</div>;
}
