// BU-07 — /tin-tuc/[slug]: SERVER component. Chỉ bài đang hiển thị (đã đăng và tới giờ); còn lại notFound() — trả giống hệt slug không tồn tại.
// Server render KHÔNG tăng lượt xem; DemLuotXem (máy khách) gọi POST …/view đúng một lần.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicArticleBySlug, getRelated } from "@/lib/articlesPublic";
import { articleJsonLd, articleMetadata, articleNotFoundMetadata, jsonLdSafe } from "@/lib/seoPublic";
import { BaiViet } from "@/components/student/tin-tuc/BaiViet";

export const dynamic = "force-dynamic";

type P = Promise<{ slug: string }>;

async function layBai(params: P) {
  const { slug } = await params;
  let s = slug;
  try { s = decodeURIComponent(slug); } catch { return null; }
  return getPublicArticleBySlug(s, new Date());
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const a = await layBai(params);
  return a ? articleMetadata(a) : articleNotFoundMetadata();
}

export default async function BaiVietPage({ params }: { params: P }) {
  const a = await layBai(params);
  if (!a) notFound();
  const now = new Date();
  const lienQuan = await getRelated(a, 4, now);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(articleJsonLd(a)) }} />
      <BaiViet bai={a} lienQuan={lienQuan} now={now} />
    </>
  );
}
