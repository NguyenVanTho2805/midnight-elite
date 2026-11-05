import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { type TinThe, gioTuongDoi, hrefBai, mocBai, nhanMuc } from "./kieu";

/** Tin liên quan: tối đa 4 bài, không chứa chính bài đang đọc (lọc lại ở đây phòng khi lib trả thừa). */
export function TinLienQuan({ bai, hienTai, now }: { bai: TinThe[]; hienTai: string; now: Date }) {
  const ds = bai.filter((a) => a.slug !== hienTai).slice(0, 4);
  if (ds.length === 0) return null;
  return (
    <section data-tin-lien-quan aria-labelledby="tlq" className="mt-10 print:hidden">
      <h2 id="tlq" className="mb-3 text-[length:var(--kin-co-tieu-de)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Tin liên quan</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {ds.map((a) => (
          <li key={a.id} className="flex min-w-0 gap-3">
            {a.coverImage && (
              <Link href={hrefBai(a.slug)} tabIndex={-1} aria-hidden className="block shrink-0 overflow-hidden rounded-[var(--kin-bo-sm)]" style={{ width: 96, height: 64, background: "var(--kin-nen-bang)" }}>
                <AnhBia src={a.coverImage} alt="" />
              </Link>
            )}
            <div className="min-w-0">
              <Link href={hrefBai(a.slug)} className="line-clamp-3 text-[length:var(--kin-co-goc)] font-medium leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</Link>
              <p className="mt-0.5 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>{nhanMuc(a.category)} · {gioTuongDoi(mocBai(a), now)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
