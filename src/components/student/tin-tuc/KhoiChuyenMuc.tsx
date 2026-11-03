import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { type TinThe, gioTuongDoi, hrefBai, hrefMuc, mocBai, nhanMuc } from "./kieu";

/** Một khối chuyên mục: 1 bài lớn (ảnh trái) + 3 bài phụ (tiêu đề + giờ, ảnh nhỏ 96×64). Khối rỗng không vẽ. */
export function KhoiChuyenMuc({ muc, bai, now }: { muc: string; bai: TinThe[]; now: Date }) {
  if (bai.length === 0) return null;
  const [lon, ...phu] = bai;
  return (
    <section data-khoi={muc} aria-labelledby={`khoi-${muc}`} className="border-t pt-4" style={{ borderColor: "var(--kin-vien-thuong)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`khoi-${muc}`} className="text-[length:var(--kin-co-tieu-de)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{nhanMuc(muc)}</h2>
        <Link href={hrefMuc(muc)} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center text-[length:var(--kin-co-goc)] font-medium"
          style={{ color: "var(--kin-nhan-link)" }}>Xem thêm →</Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <article className="flex min-w-0 gap-3">
          {lon.coverImage && (
            <Link href={hrefBai(lon.slug)} tabIndex={-1} aria-hidden className="block w-[40%] shrink-0 self-start overflow-hidden rounded-[var(--kin-bo-lg)]"
              style={{ aspectRatio: "5 / 3", background: "var(--kin-nen-bang)" }}>
              <AnhBia src={lon.coverImage} alt="" />
            </Link>
          )}
          <div className="min-w-0">
            <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>
              <Link href={hrefBai(lon.slug)}>{lon.title}</Link>
            </h3>
            <p className="mt-1 line-clamp-3 text-[length:var(--kin-co-goc)] leading-5" style={{ color: "var(--kin-chu-phu)" }}>{lon.excerpt}</p>
          </div>
        </article>
        {phu.length > 0 && (
          <ul className="flex min-w-0 flex-col gap-3">
            {phu.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                {a.coverImage && (
                  <Link href={hrefBai(a.slug)} tabIndex={-1} aria-hidden className="block shrink-0 overflow-hidden rounded-[var(--kin-bo-sm)]"
                    style={{ width: 96, height: 64, background: "var(--kin-nen-bang)" }}>
                    <AnhBia src={a.coverImage} alt="" />
                  </Link>
                )}
                <div className="min-w-0">
                  <Link href={hrefBai(a.slug)} className="line-clamp-2 text-[length:var(--kin-co-goc)] font-medium leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</Link>
                  <p className="mt-0.5 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>{gioTuongDoi(mocBai(a), now)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
