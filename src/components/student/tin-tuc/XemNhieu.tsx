import Link from "next/link";
import { type TinThe, hrefBai } from "./kieu";

/** "Xem nhiều": 5 bài, số thứ tự lớn, KHÔNG hiện số lượt. `ngang` = dải cuộn ngang cho điện thoại. */
export function XemNhieu({ bai, ngang = false }: { bai: TinThe[]; ngang?: boolean }) {
  const ds = bai.slice(0, 5);
  if (ds.length === 0) return null;
  if (ngang) {
    return (
      <section data-xem-nhieu="ngang" aria-labelledby="xn-ngang" className="border-b py-3" style={{ borderColor: "var(--kin-vien-thuong)" }}>
        <h2 id="xn-ngang" className="px-4 pb-2 text-[length:var(--kin-co-body)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Xem nhiều</h2>
        <ol className="flex gap-3 overflow-x-auto px-4 pb-1">
          {ds.map((a, i) => (
            <li key={a.id} className="w-[220px] shrink-0 rounded-[var(--kin-bo-lg)] border p-3" style={{ borderColor: "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }}>
              <span className="text-[length:var(--kin-co-so)] font-bold" style={{ color: "var(--kin-nhan-link)" }}>{i + 1}</span>
              <Link href={hrefBai(a.slug)} className="mt-1 line-clamp-3 block min-h-[var(--kin-cham-toi-thieu)] text-[length:var(--kin-co-goc)] font-medium leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</Link>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <aside data-xem-nhieu="doc" aria-labelledby="xn-doc" className="sticky top-20 rounded-[var(--kin-bo-xl)] border p-4" style={{ borderColor: "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }}>
      <h2 id="xn-doc" className="mb-2 text-[length:var(--kin-co-tieu-de)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Xem nhiều</h2>
      <ol>
        {ds.map((a, i) => (
          <li key={a.id} className="flex items-start gap-3 border-b py-3 last:border-b-0" style={{ borderColor: "var(--kin-vien-thuong)" }}>
            <span className="w-7 shrink-0 text-[length:var(--kin-co-so)] font-bold leading-none" style={{ color: "var(--kin-nhan-link)" }}>{i + 1}</span>
            <Link href={hrefBai(a.slug)} className="text-[length:var(--kin-co-goc)] font-medium leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}
