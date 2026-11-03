import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { type TinThe, gioTuongDoi, hrefBai, mocBai, nhanMuc } from "./kieu";

/** Cột tin phụ 280: 2 bài có ảnh 280×168 + 3 dòng tiêu đề thuần. */
export function TinPhu({ bai, now }: { bai: TinThe[]; now: Date }) {
  const coAnh = bai.slice(0, 2);
  const dong = bai.slice(2, 5);
  return (
    <div data-tin="phu" className="flex min-w-0 flex-col gap-4">
      {coAnh.map((a) => (
        <article key={a.id}>
          {a.coverImage && (
            <Link href={hrefBai(a.slug)} tabIndex={-1} aria-hidden className="mb-2 block overflow-hidden rounded-[var(--kin-bo-lg)]"
              style={{ aspectRatio: "280 / 168", background: "var(--kin-nen-bang)" }}>
              <AnhBia src={a.coverImage} alt="" />
            </Link>
          )}
          <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>
            <Link href={hrefBai(a.slug)}>{a.title}</Link>
          </h3>
          <p className="mt-1 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>{nhanMuc(a.category)} · {gioTuongDoi(mocBai(a), now)}</p>
        </article>
      ))}
      {dong.length > 0 && (
        <ul className="border-t pt-2" style={{ borderColor: "var(--kin-vien-thuong)" }}>
          {dong.map((a) => (
            <li key={a.id} className="border-b last:border-b-0" style={{ borderColor: "var(--kin-vien-thuong)" }}>
              <Link href={hrefBai(a.slug)} className="flex min-h-[var(--kin-cham-toi-thieu)] items-center py-2 text-[length:var(--kin-co-goc)] font-medium leading-snug"
                style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
