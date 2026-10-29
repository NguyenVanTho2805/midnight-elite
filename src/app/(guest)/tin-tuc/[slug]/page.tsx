"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";

type Category = "hoc-thuat" | "tuyen-sinh" | "tin-midnight" | "kinh-nghiem";

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: Category;
  author: string;
  tag: string | null;
  isPinned: boolean;
  readTime: number;
  views: number;
  publishedAt: string | null;
  createdAt: string;
  sourceUrl: string | null;
  sourceName: string | null;
  coverImage: string | null;
}

const catColors: Record<Category, { bg: string; color: string }> = {
  "hoc-thuat":   { bg: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" },
  "tuyen-sinh":  { bg: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" },
  "tin-midnight":{ bg: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" },
  "kinh-nghiem": { bg: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" },
};

const catLabels: Record<Category, string> = {
  "hoc-thuat":   "Học thuật",
  "tuyen-sinh":  "Tuyển sinh",
  "tin-midnight":"Tin KiN",
  "kinh-nghiem": "Kinh nghiệm",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function renderContent(content: string) {
  return content.split(/\n{2,}/).map((para, i) => (
    <p key={i} className="leading-relaxed mb-5" style={{ color: "var(--kin-chu-phu)" }}>
      {para.split("\n").map((line, j, arr) => (
        <span key={j}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ))}
    </p>
  ));
}

export default function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [article, setArticle]   = useState<Article | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  // Link ảnh bìa (vd. ảnh Facebook) có thể hết hạn: ảnh không tải được thì bỏ khung ảnh, bài vẫn đọc bình thường.
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/articles?slug=${encodeURIComponent(slug)}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => { if (data) setArticle(data); })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        {[80, 60, 40, 100, 90, 70].map((w, i) => (
          <div key={i} className="h-4 rounded animate-pulse" style={{ background: "var(--kin-vien-thuong)", width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Không thể tải bài viết</h1>
        <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Kiểm tra kết nối và thử lại.</p>
        <Link href="/tin-tuc"
          className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--kin-nhan-nen)" }}>
          ← Quay lại Tin tức
        </Link>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">📰</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Không tìm thấy bài viết</h1>
        <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Bài viết không tồn tại hoặc đã bị gỡ.</p>
        <Link href="/tin-tuc"
          className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--kin-nhan-nen)" }}>
          ← Quay lại Tin tức
        </Link>
      </div>
    );
  }

  const cat = catColors[article.category] ?? { bg: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-8" style={{ color: "var(--kin-chu-mo)" }}>
        <Link href="/" className="hover:underline">Trang chủ</Link>
        <span>/</span>
        <Link href="/tin-tuc" className="hover:underline">Tin tức</Link>
        <span>/</span>
        <span className="truncate max-w-[200px]" style={{ color: "var(--kin-chu-mo)" }}>{article.title}</span>
      </nav>

      {/* Category + tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: cat.bg, color: cat.color }}>
          {catLabels[article.category] ?? article.category}
        </span>
        {article.tag && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: "var(--kin-nhan-nen)" }}>{article.tag}</span>
        )}
        {article.isPinned && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>📌 Nổi bật</span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight mb-4"
        style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
        {article.title}
      </h1>

      {/* Excerpt */}
      <p className="text-base leading-relaxed mb-6" style={{ color: "var(--kin-chu-mo)" }}>{article.excerpt}</p>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs pb-6 mb-8"
        style={{ color: "var(--kin-chu-mo)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        <span className="font-semibold" style={{ color: "var(--kin-chu-phu)" }}>{article.author}</span>
        <span>·</span>
        <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
        <span>·</span>
        <span>{article.readTime} phút đọc</span>
        <span>·</span>
        <span>{article.views.toLocaleString("vi-VN")} lượt xem</span>
      </div>

      {/* Ảnh bìa (NC2-051): GIỮ nguyên tỉ lệ, không cắt — poster tuyển sinh dạng đứng mà bị cắt dải ngang sẽ mất chữ */}
      {article.coverImage && !coverFailed && (
        // eslint-disable-next-line @next/next/no-img-element -- link ngoài do quản trị nhập; không đi qua trình tối ưu ảnh của Next
        <img src={article.coverImage} alt={`Ảnh bìa: ${article.title}`} data-article-cover
          referrerPolicy="no-referrer" loading="lazy" onError={() => setCoverFailed(true)}
          className="mx-auto mb-8 h-auto max-w-full rounded-xl" style={{ maxHeight: 560 }} />
      )}

      {/* Content */}
      <div className="text-base" style={{ lineHeight: 1.8 }}>
        {renderContent(article.content)}
      </div>

      {/* Nguồn (NC2-051): bài đăng lại từ bài gốc thì ghi nguồn kèm link */}
      {article.sourceUrl && (
        <p data-article-source className="mt-8 text-sm" style={{ color: "var(--kin-chu-mo)" }}>
          Nguồn:{" "}
          <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
            className="inline-flex items-center min-h-11 underline" style={{ color: "var(--kin-nhan-link)" }}>
            {article.sourceName || article.sourceUrl}<span aria-hidden> ↗</span>
          </a>
        </p>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
        <Link href="/tin-tuc"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--kin-nhan-link)" }}>
          ← Xem tất cả bài viết
        </Link>
      </div>

    </div>
  );
}
