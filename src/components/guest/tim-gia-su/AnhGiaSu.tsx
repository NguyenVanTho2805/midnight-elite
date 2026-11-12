// LOI-05 — ảnh tròn của gia sư, hoặc khối tròn chữ cái đầu khi không có ảnh. Dùng ở thẻ danh sách và đầu hồ sơ.
// Chỉ nhận ảnh dạng data:image/… (ảnh đã lưu trong hồ sơ); chuỗi khác (http:, javascript:…) coi như không có ảnh. Không ảnh giả.
// Không "use client": dùng được trong trang máy chủ và trong SanGiaSu (client).
import { initialsOf } from "@/lib/tutorCardView";

export const anhAnToan = (src: string | null | undefined): string | null => (typeof src === "string" && src.startsWith("data:image/") ? src : null);

export function AnhGiaSu({ name, src, className, chuClass, alt = "" }: {
  name: string;
  src: string | null | undefined;
  /** Cỡ khối tròn, ví dụ "h-[88px] w-[88px] lg:h-24 lg:w-24". */
  className: string;
  /** Cỡ chữ cái đầu. */
  chuClass: string;
  /** Ảnh cạnh tên thì để trống (tên đã đọc được); ảnh đứng một mình thì truyền tên. */
  alt?: string;
}) {
  const safe = anhAnToan(src);
  return (
    <div
      data-anh-gia-su={safe ? "anh" : "chu"}
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full`}
      style={{ background: "var(--kin-nen-dang-chon)", color: "var(--kin-th-navy)" }}
    >
      {safe
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={safe} alt={alt} className="h-full w-full object-cover" />
        : <span aria-hidden className={`font-semibold leading-none ${chuClass}`}>{initialsOf(name)}</span>}
    </div>
  );
}
