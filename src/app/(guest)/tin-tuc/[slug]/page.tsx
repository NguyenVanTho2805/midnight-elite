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
}

const catColors: Record<Category, { bg: string; color: string }> = {
  "hoc-thuat":   { bg: "#dbeafe", color: "#0068FF" },
  "tuyen-sinh":  { bg: "#fee2e2", color: "#dc2626" },
  "tin-midnight":{ bg: "#dcfce7", color: "#16a34a" },
  "kinh-nghiem": { bg: "#fef3c7", color: "#b45309" },
};

const catLabels: Record<Category, string> = {
  "hoc-thuat":   "Học thuật",
  "tuyen-sinh":  "Tuyển sinh",
  "tin-midnight":"Tin Midnight Elite",
  "kinh-nghiem": "Kinh nghiệm",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function renderContent(content: string) {
  return content.split(/\n{2,}/).map((para, i) => (
    <p key={i} className="leading-relaxed mb-5" style={{ color: "#37352f" }}>
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
          <div key={i} className="h-4 rounded animate-pulse" style={{ background: "#e5e3df", width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Không thể tải bài viết</h1>
        <p className="text-sm mb-6" style={{ color: "#787671" }}>Kiểm tra kết nối và thử lại.</p>
        <Link href="/tin-tuc"
          className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "#0068FF" }}>
          ← Quay lại Tin tức
        </Link>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">📰</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Không tìm thấy bài viết</h1>
        <p className="text-sm mb-6" style={{ color: "#787671" }}>Bài viết không tồn tại hoặc đã bị gỡ.</p>
        <Link href="/tin-tuc"
          className="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "#0068FF" }}>
          ← Quay lại Tin tức
        </Link>
      </div>
    );
  }

  const cat = catColors[article.category] ?? { bg: "#f6f5f4", color: "#787671" };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs mb-8" style={{ color: "#a4a097" }}>
        <Link href="/" className="hover:underline">Trang chủ</Link>
        <span>/</span>
        <Link href="/tin-tuc" className="hover:underline">Tin tức</Link>
        <span>/</span>
        <span className="truncate max-w-[200px]" style={{ color: "#787671" }}>{article.title}</span>
      </nav>

      {/* Category + tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: cat.bg, color: cat.color }}>
          {catLabels[article.category] ?? article.category}
        </span>
        {article.tag && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: "#0068FF" }}>{article.tag}</span>
        )}
        {article.isPinned && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "#fef3c7", color: "#b45309" }}>📌 Nổi bật</span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight mb-4"
        style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
        {article.title}
      </h1>

      {/* Excerpt */}
      <p className="text-base leading-relaxed mb-6" style={{ color: "#787671" }}>{article.excerpt}</p>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs pb-6 mb-8"
        style={{ color: "#a4a097", borderBottom: "1px solid #e5e3df" }}>
        <span className="font-semibold" style={{ color: "#37352f" }}>{article.author}</span>
        <span>·</span>
        <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
        <span>·</span>
        <span>{article.readTime} phút đọc</span>
        <span>·</span>
        <span>{article.views.toLocaleString("vi-VN")} lượt xem</span>
      </div>

      {/* Content */}
      <div className="text-base" style={{ lineHeight: 1.8 }}>
        {renderContent(article.content)}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8" style={{ borderTop: "1px solid #e5e3df" }}>
        <Link href="/tin-tuc"
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "#0068FF" }}>
          ← Xem tất cả bài viết
        </Link>
      </div>

    </div>
  );
}
