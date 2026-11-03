import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { ChiaSe } from "./ChiaSe";
import { type TinThe, gioTuongDoi, hrefBai, mauMuc, mocBai, nhanMuc } from "./kieu";

/** Một dòng tin kiểu Threads (điện thoại): cột trái 48 + avatar 36 (chữ cái đầu của mục), cột phải nội dung. */
export function DongTin({ bai, now }: { bai: TinThe; now: Date }) {
  const m = mauMuc(bai.category);
  const nhan = nhanMuc(bai.category);
  return (
    <article data-dong-tin className="flex gap-0 border-b px-4 py-3" style={{ borderColor: "var(--kin-vien-thuong)" }}>
      <div className="w-12 shrink-0">
        <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full text-[length:var(--kin-co-goc)] font-bold" style={{ background: m.nen, color: m.chu }}>
          {nhan.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>
          <span className="font-semibold" style={{ color: "var(--kin-chu-phu)" }}>{nhan}</span> · {gioTuongDoi(mocBai(bai), now)}
        </p>
        <h3 className="mt-0.5 text-[length:var(--kin-co-body)] font-semibold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>
          <Link href={hrefBai(bai.slug)} className="block py-0.5">{bai.title}</Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[length:15px] leading-[21px]" style={{ color: "var(--kin-chu-phu)" }}>{bai.excerpt}</p>
        {bai.coverImage && (
          <Link href={hrefBai(bai.slug)} tabIndex={-1} aria-hidden className="mt-2 block overflow-hidden rounded-[var(--kin-bo-xl)]"
            style={{ aspectRatio: "5 / 3", background: "var(--kin-nen-bang)" }}>
            <AnhBia src={bai.coverImage} alt="" />
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <ChiaSe kieu="dong" duongDan={hrefBai(bai.slug)} tieuDe={bai.title} />
          <Link href={hrefBai(bai.slug)} data-dong-mo className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-[length:var(--kin-co-goc)] font-medium" style={{ color: "var(--kin-nhan-link)" }}>Mở</Link>
        </div>
      </div>
    </article>
  );
}
