import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { ChipMuc } from "./ChipMuc";
import { type TinThe, gioTuongDoi, hrefBai, mocBai } from "./kieu";

/** Bài nổi bật: ảnh tỉ lệ 5:3 (≈ 680×408), tiêu đề lớn, sapo 2 dòng, mục · giờ. */
export function TinNoiBat({ bai, now }: { bai: TinThe; now: Date }) {
  return (
    <article data-tin="noi-bat" className="min-w-0">
      {bai.coverImage && (
        <Link href={hrefBai(bai.slug)} tabIndex={-1} aria-hidden className="mb-3 block overflow-hidden rounded-[var(--kin-bo-xl)]"
          style={{ aspectRatio: "5 / 3", background: "var(--kin-nen-bang)" }}>
          <AnhBia src={bai.coverImage} alt="" />
        </Link>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>
        <ChipMuc muc={bai.category} /><span>{gioTuongDoi(mocBai(bai), now)}</span>
      </div>
      <h2 className="text-[length:var(--kin-co-so)] font-bold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>
        <Link href={hrefBai(bai.slug)}>{bai.title}</Link>
      </h2>
      <p className="mt-2 line-clamp-2 text-[length:var(--kin-co-body)] leading-6" style={{ color: "var(--kin-chu-phu)" }}>{bai.excerpt}</p>
    </article>
  );
}
