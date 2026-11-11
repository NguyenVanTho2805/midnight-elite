// Mảnh dùng chung của các khối trang chủ (BU-HS-LANDING): liên kết nội dung sửa được, đầu khối (nhãn + tiêu đề + câu phụ), phần chữ của "Tìm gia sư".
// Component máy chủ, KHÔNG hook, KHÔNG prisma — HomeSections (cũng dùng ở bản xem trước quản trị) nhập được.
import Link from "next/link";
import type { ReactNode } from "react";
import { isExternalHref, type HomeContent } from "@/lib/siteContent";

/** Liên kết nội dung sửa được: https:// ngoài → thẻ <a> mở tab mới; đường nội bộ → Link. */
export function ContentLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return isExternalHref(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>;
}

/** Khung ngoài mỗi khối: bề rộng 1120, đệm dọc 48px. Nền do khung `data-home-alt` của HomeSections quyết, khối không tự đặt nền. */
export const BLOCK_INNER = "mx-auto max-w-[1120px] px-4 sm:px-8 py-12";

/** Đầu khối: nhãn nhỏ viết hoa (tuỳ chọn) + h2 + câu phụ, canh giữa. */
export function BlockHead({ id, label, title, desc }: { id: string; label?: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto mb-8 flex max-w-[640px] flex-col items-center gap-2 text-center">
      {label && <p className="text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.09em] text-[var(--kin-nhan-link)]">{label}</p>}
      <h2 id={id} className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">{title}</h2>
      {desc && <p className="text-[length:var(--kin-co-small)] leading-[1.6] text-[var(--kin-chu-phu)]">{desc}</p>}
    </div>
  );
}

/** Dòng "Xem tất cả …" dưới lưới: liên kết gạch chân, cao ≥ 44px, canh giữa. */
export function BlockMore({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link href={href} className="inline-flex min-h-11 items-center text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-nhan-link)] underline">{children}</Link>
    </div>
  );
}

/** Phần chữ phía trên của "Tìm gia sư" (HOME-01): tiêu đề + mô tả. `id="h-tim-gia-su"` giữ nguyên cho aria-labelledby và bài kiểm. */
export function FindTutorHead({ f }: { f: HomeContent["findTutor"] }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center gap-3 text-center">
      <h2 id="h-tim-gia-su" className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">{f.title}</h2>
      <p className="max-w-[560px] text-[length:var(--kin-co-small)] leading-[1.6] text-[var(--kin-chu-phu)]">{f.desc}</p>
    </div>
  );
}

/** Phần dưới của "Tìm gia sư": nút đặc, dòng cho phụ huynh, lối đăng ký gia sư (liên kết cố định, không sửa được từ quản trị). */
export function FindTutorFoot({ f }: { f: HomeContent["findTutor"] }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center gap-3 text-center">
      <ContentLink
        href={f.buttonHref}
        className="inline-flex w-full sm:w-auto items-center justify-center min-h-12 px-8 rounded-[var(--kin-bo-md)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] font-semibold text-[length:var(--kin-co-body)] transition-opacity hover:opacity-90"
      >
        {f.buttonLabel}
      </ContentLink>
      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{f.parentNote}</p>
      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
        Bạn là gia sư?{" "}
        <Link href="/dang-ky?vai=gia-su" className="inline-flex items-center min-h-11 font-semibold text-[var(--kin-nhan-link)] underline">Đăng ký gia sư</Link>
      </p>
    </div>
  );
}
