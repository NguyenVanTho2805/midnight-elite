// Khung trang gia sư (rà soát căn chỉnh 23/10/2026; mẫu: Hộp việc, Figma 299:111821).
// MỘT nơi định nghĩa lề trang, H1 + dòng phụ + nút ở góc phải, trang hai cột (1fr + 354px) và hàng bảng,
// để mọi màn gia sư (Hộp việc, Lịch, Lớp, Chi tiết lớp, Tạo lớp, Học sinh, Thư viện, Học phí, Cài đặt…) cùng một số đo.
// Số đo nằm ở token trong src/app/kin-site.css (--kin-co-h1, --kin-cot-phai, --kin-cach-cot, --kin-hang-bang…).
import Link from "next/link";
import type { ReactNode } from "react";

/** Lề trang: 16px ở điện thoại, 40px từ md; cách đỉnh 24/32px. Dùng thẳng làm className khi gốc trang là <form>. */
export const KIN_PAGE = "px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]";

/** Trang hai cột: cột trái co giãn, cột phải 354px (từ lg); một cột ở điện thoại. */
export const KIN_TWO_COL = "grid lg:grid-cols-[minmax(0,1fr)_var(--kin-cot-phai)] gap-x-[var(--kin-cach-cot)] gap-y-[var(--kin-cach-muc)] items-start";

/** Hàng tiêu đề bảng (máy tính) và hàng bảng: cùng chiều cao ở mọi bảng. Thêm lưới cột (grid-cols-…) ở nơi dùng. */
export const KIN_TABLE_HEAD = "px-[var(--kin-kc-6)] min-h-[var(--kin-dau-bang)] items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]";
export const KIN_TABLE_ROW = "px-[var(--kin-kc-6)] py-[var(--kin-kc-4)] md:min-h-[var(--kin-hang-bang)] items-center border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] leading-5";

/** Ô nhập một dòng 44px, chữ 14px, bo --kin-bo-md; nhãn 14px cách ô 8px. Dùng cho ô tìm, ô lọc, ô form trang gia sư. */
export const KIN_FIELD = "w-full min-h-[var(--kin-cham-toi-thieu)] px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";
export const KIN_LABEL = "block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]";

export function KinPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-kin-page className={`${KIN_PAGE} ${className}`}>{children}</div>;
}

export function KinTwoCol({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div data-kin-two-col className={`${KIN_TWO_COL} ${className}`}>{children}</div>;
}

/**
 * Đầu trang: H1 (27.6px/36px, đậm vừa), dòng phụ xám 14px cách H1 4px, nút hành động ở góc phải, căn giữa theo khối tiêu đề như Figma (xuống dưới ở điện thoại).
 * `back`: liên kết quay lại nằm trên dòng phụ, KHÔNG đẩy H1 xuống (H1 luôn cùng một độ cao ở mọi trang).
 */
export function KinPageHeader({ title, sub, actions, back, titleClassName = "", live }: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  titleClassName?: string;
  /** Dòng phụ đổi theo thao tác (vd. tuần đang xem): đọc lại cho trình đọc màn hình. */
  live?: boolean;
}) {
  return (
    <header data-kin-page-header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className={`text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)] ${titleClassName}`}>{title}</h1>
        {(sub != null || back) && (
          <p className="mt-1 text-[length:var(--kin-co-goc)] leading-[var(--kin-dong-goc)] text-[var(--kin-chu-mo)]" aria-live={live ? "polite" : undefined}>
            {back && (
              <>
                {/* vùng chạm 44px nhưng chiếm đúng một dòng chữ (margin âm) */}
                <Link href={back.href} className="inline-flex items-center min-h-11 -my-3 align-middle hover:underline">{back.label}</Link>
                {sub != null && " · "}
              </>
            )}
            {sub}
          </p>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-3 flex-wrap self-start sm:self-center flex-shrink-0">{actions}</div>}
    </header>
  );
}

/**
 * Khung xương cho trang đang tải: đầu trang (cao đúng H1 + dòng phụ) + dải số tuỳ chọn + hai cột. Cùng lề với trang thật nên không nhảy bố cục.
 * Chiều cao các khối lấy theo số đo thật: ô số 84px (nhãn 20 + số 28 + dòng phụ 20 + khoảng cách), hàng danh sách 62px.
 */
export function KinPageSkeleton({ label = "Đang tải", stats = false, rows = 4, side = true }: { label?: string; stats?: boolean; rows?: number; side?: boolean }) {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div data-kin-page-skeleton aria-busy="true" aria-label={label} className={KIN_PAGE}>
      <div className="pb-6">
        <div className={`h-9 w-48 rounded ${sk}`} />
        <div className={`mt-1 h-5 w-72 max-w-full rounded ${sk}`} />
      </div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 py-6 border-y border-[var(--kin-vien-nhat)] mb-8">
          {[0, 1, 2, 3].map(i => <div key={i} className={`h-[86px] rounded ${sk}`} />)}
        </div>
      )}
      <div className={side ? KIN_TWO_COL : ""}>
        <div className="space-y-3 min-w-0">{Array.from({ length: rows }, (_, i) => <div key={i} className={`h-[var(--kin-hang-bang)] rounded ${sk}`} />)}</div>
        {side && <div className={`h-[220px] rounded ${sk}`} />}
      </div>
    </div>
  );
}

/**
 * Khung xương của bảng/danh sách dạng bảng: ô lọc (cao 73px = nhãn + ô 44px), tab tuỳ chọn, hàng tiêu đề 44px, hàng 62px kẻ mảnh như hàng thật.
 * Cùng số đo với KIN_TABLE_HEAD / KIN_TABLE_ROW nên khi dữ liệu về, bảng không nhảy.
 */
export function KinTableSkeleton({ label, tabs = false, rows = 5 }: { label: string; tabs?: boolean; rows?: number }) {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label={label}>
      <div className={`h-[73px] rounded ${sk}`} />
      {tabs && <div className={`mt-6 h-11 rounded ${sk}`} />}
      <div className={tabs ? "mt-4" : "mt-6"}>
        <div aria-hidden className={`hidden md:block h-[var(--kin-dau-bang)] ${sk}`} />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-[var(--kin-hang-bang)] max-md:h-[120px] border-b border-[var(--kin-vien-nhat)] flex items-center px-[var(--kin-kc-6)]">
            <div className={`h-4 w-2/3 rounded ${sk}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
