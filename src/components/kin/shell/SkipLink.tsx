// SCL-G-0 (21/11/2026, WCAG 2.4.1) — "Bỏ qua tới nội dung": phần tử đầu tiên của mỗi vỏ (học sinh, gia sư, quản trị). Ẩn tới khi được Tab tới.
// Bấm thì đưa tiêu điểm tới <KinSkipTarget> CỦA CÙNG VỎ (tìm trong phần tử cha, không theo id): Next 16 giữ trang vừa xem ẩn trong DOM,
// nên `#noi-dung` có thể trùng và trình duyệt sẽ nhảy vào bản đang ẩn. href vẫn là "#noi-dung" để chạy được khi JS chưa tải.
"use client";
import type { MouseEvent } from "react";

export function KinSkipLink() {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    const target = e.currentTarget.parentElement?.querySelector<HTMLElement>("[data-kin-noi-dung]");
    if (!target) return;
    e.preventDefault();
    target.focus();
    target.scrollIntoView({ block: "start" });
  };
  return (
    <a href="#noi-dung" onClick={go} data-kin-skip
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:inline-flex focus:items-center focus:min-h-[var(--kin-cham-toi-thieu)] focus:px-4 focus:rounded-[var(--kin-bo-md)] focus:bg-[var(--kin-nhan-nen)] focus:text-[var(--kin-nhan-chu-tren-nen)] focus:font-semibold focus:text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
      Bỏ qua tới nội dung
    </a>
  );
}

/** Đặt ngay trước nội dung trang (sau dải trên). Không chiếm chỗ; Tab tiếp theo đi vào phần tử đầu tiên của nội dung. */
export function KinSkipTarget() {
  return <span id="noi-dung" data-kin-noi-dung tabIndex={-1} className="block outline-none" />;
}
