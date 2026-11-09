// Khối "Tin tức" trang chủ (BU-HS-LANDING 3.5): 3 bài đã đăng mới nhất (bộ tải đã lọc đã đăng/đã tới giờ). Cả thẻ là liên kết /tin-tuc/<slug>.
// Điện thoại: hàng ngang (ảnh vuông 96px + chữ). Từ sm: thẻ dọc, ảnh 16:9. Không có ảnh bìa hợp lệ → khung nền nhạt kèm nhãn mục. Máy chủ, không hook, không prisma. Không bài → không vẽ gì.
import Link from "next/link";
import type { LandingArticle } from "@/lib/homeLanding";
import { BLOCK_INNER, BlockHead, BlockMore } from "./HomeBlockParts";

function HomeNewsCard({ a }: { a: LandingArticle }) {
  return (
    <article data-home-news={a.slug}
      className="relative flex min-w-0 gap-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] p-3 transition-colors hover:border-[var(--kin-vien-o-nhap)] sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0 sm:basis-[calc((100%-24px)/3)]">
      {a.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverImage} alt="" loading="lazy" className="h-24 w-24 flex-shrink-0 rounded-[var(--kin-bo-sm)] object-cover sm:aspect-[16/9] sm:h-auto sm:w-full sm:rounded-none" />
      ) : (
        <div aria-hidden="true" className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-nhan)] px-1 text-center text-[length:var(--kin-co-caption)] font-semibold text-[var(--kin-nhan-link)] sm:aspect-[16/9] sm:h-auto sm:w-full sm:rounded-none">
          <span className="min-w-0 truncate">{a.categoryLabel}</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:p-4">
        <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
          {a.coverImage && <span className="font-semibold uppercase tracking-[0.04em] text-[var(--kin-nhan-link)]">{a.categoryLabel}</span>}
          {a.coverImage && a.dateText && " · "}
          {a.dateText}
        </p>
        <h3 className="text-[length:var(--kin-co-body)] font-semibold leading-snug text-[var(--kin-chu-chinh)]">
          <Link href={`/tin-tuc/${a.slug}`} className="block min-h-11 line-clamp-3 sm:line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">{a.title}</Link>
        </h3>
        {a.excerpt && <p className="hidden text-[length:var(--kin-co-small)] leading-[1.55] text-[var(--kin-chu-phu)] sm:block">{a.excerpt}</p>}
      </div>
    </article>
  );
}

export default function HomeNews({ articles }: { articles: LandingArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="home-tin-tuc" data-home-block="news">
      <div className={BLOCK_INNER}>
        <BlockHead id="home-tin-tuc" label="Tin tức" title="Tin giáo dục và tuyển sinh" desc="Tuyển sinh, học tập, tin từ KiN — ghi rõ nguồn." />
        <div role="list" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {articles.map(a => (
            <div role="listitem" key={a.slug} className="contents"><HomeNewsCard a={a} /></div>
          ))}
        </div>
        <BlockMore href="/tin-tuc">Xem tất cả tin tức →</BlockMore>
      </div>
    </section>
  );
}
