// Thẻ trạng thái dùng chung (Figma "Hệ thống · Trạng thái và xác nhận" 299:117032): rỗng / đang tải / lỗi / thành công / cần xác nhận.
// Thẻ trắng viền mảnh, chữ canh trái: nhãn loại (chữ hoa nhỏ) → tiêu đề → dòng trạng thái (KinStatus) → câu giải thích → nút → ghi chú.
// Màu không nói một mình: dòng trạng thái luôn có chữ. Lỗi là role=alert, còn lại role=status. Không vòng xoay: đang tải dùng KinSkeleton + câu chữ.
import type { ReactNode } from "react";

export interface KinStateCardProps {
  /** Nhãn loại, ví dụ "Trống · Gia sư", "Lỗi · Có thể thử lại" (tự viết hoa bằng CSS). */
  kicker: string;
  title: ReactNode;
  /** Dòng trạng thái: thường là <KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>. */
  status?: ReactNode;
  /** Câu giải thích: vì sao trống, chuyện gì xảy ra, việc làm tiếp. */
  children?: ReactNode;
  /** Nút / liên kết hành động (một nút đặc, nút phụ cạnh nó). */
  actions?: ReactNode;
  /** Ghi chú nhỏ dưới cùng, chữ xám. */
  note?: ReactNode;
  tone?: "thuong" | "loi";
  /** Đang tải: thẻ báo bận cho trình đọc màn hình. */
  busy?: boolean;
  /** Cấp thẻ tiêu đề (mặc định h2; trang toàn màn như 404 dùng h1). */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

export function KinStateCard({ kicker, title, status, children, actions, note, tone = "thuong", busy, as: Tag = "h2", className = "" }: KinStateCardProps) {
  return (
    <section
      role={tone === "loi" ? "alert" : "status"}
      aria-busy={busy || undefined}
      data-kin-state={tone === "loi" ? "loi" : busy ? "tai" : "thuong"}
      className={`flex flex-col gap-[var(--kin-kc-6)] p-[var(--kin-kc-8)] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] ${className}`}
    >
      <p className="text-[length:var(--kin-co-caption)] uppercase tracking-[0.04em] text-[var(--kin-chu-mo)]">{kicker}</p>
      <Tag className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{title}</Tag>
      {status && <div className="text-[length:var(--kin-co-goc)]">{status}</div>}
      {children && <div className="text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-phu)]">{children}</div>}
      {actions && <div className="flex flex-wrap items-center gap-[var(--kin-kc-4)]">{actions}</div>}
      {note && <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{note}</p>}
    </section>
  );
}

/** Dải xám giữ chỗ khi đang tải (Figma: ba thanh dài ngắn khác nhau). Không số liệu tạm. `widths` là phần trăm. */
export function KinSkeleton({ widths = [100, 76, 58], className = "" }: { widths?: number[]; className?: string }) {
  return (
    <div aria-hidden data-kin-skeleton className={`flex flex-col gap-[var(--kin-kc-5)] ${className}`}>
      {widths.map((w, i) => <div key={i} className="h-3 rounded-[var(--kin-bo-tron)] bg-[var(--kin-vien-nhat)] animate-pulse" style={{ width: `${w}%` }} />)}
    </div>
  );
}
