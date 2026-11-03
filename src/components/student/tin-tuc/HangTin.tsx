import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { ChipMuc } from "./ChipMuc";
import { type TinThe, gioTuongDoi, hrefBai, mocBai } from "./kieu";

/** Hàng tin máy tính (trang một chuyên mục): ảnh nhỏ trái, tiêu đề + sapo phải. */
export function HangTin({ bai, now }: { bai: TinThe; now: Date }) {
  return (
    <article data-hang-tin className="flex min-w-0 gap-4 border-b py-4" style={{ borderColor: "var(--kin-vien-thuong)" }}>
      {bai.coverImage && (
        <Link href={hrefBai(bai.slug)} tabIndex={-1} aria-hidden className="block w-[200px] shrink-0 self-start overflow-hidden rounded-[var(--kin-bo-lg)]"
          style={{ aspectRatio: "5 / 3", background: "var(--kin-nen-bang)" }}>
          <AnhBia src={bai.coverImage} alt="" />
        </Link>
      )}
      <div className="min-w-0">
        <h3 className="text-[length:var(--kin-co-tieu-de)] font-semibold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>
          <Link href={hrefBai(bai.slug)}>{bai.title}</Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[length:var(--kin-co-goc)] leading-5" style={{ color: "var(--kin-chu-phu)" }}>{bai.excerpt}</p>
        <div className="mt-2 flex items-center gap-2 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>
          <ChipMuc muc={bai.category} /><span>{gioTuongDoi(mocBai(bai), now)}</span>
        </div>
      </div>
    </article>
  );
}
