// BU-05 — lưới 3 cột 1:1 các bài chung của người đó: ô có ảnh hiện ảnh đầu, ô chỉ chữ hiện 4 dòng đầu; bấm mở bài. Số bài bằng 0 → "Chưa có bài viết".
import Link from "next/link";
import type { GridItem } from "@/lib/communityTypes";

export function ProfileGrid({ items }: { items: GridItem[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" role="status">Chưa có bài viết</p>;
  }
  return (
    <ul className="kc-pgrid" aria-label="Bài viết">
      {items.map(it => (
        <li key={it.id}>
          <Link href={it.href} className="kc-pcell kc-focus" aria-label={it.excerpt ? `Mở bài: ${it.excerpt.slice(0, 60)}` : "Mở bài có ảnh"}>
            {it.imageUrl
              // eslint-disable-next-line @next/next/no-img-element -- ảnh người dùng tải lên
              ? <img src={it.imageUrl} alt="" loading="lazy" />
              : <p>{it.excerpt}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
