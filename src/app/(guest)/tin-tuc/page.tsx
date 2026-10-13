"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Category = "all" | "hoc-thuat" | "tuyen-sinh" | "tin-midnight" | "kinh-nghiem";

interface Article {
  id: string;
  slug: string;
  category: Exclude<Category, "all">;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string | null;
  createdAt: string;
  readTime: number;
  isPinned: boolean;
  tag: string | null;
  views: number;
}

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "all",           label: "Tất cả"            },
  { id: "hoc-thuat",    label: "Học thuật"          },
  { id: "tuyen-sinh",   label: "Tuyển sinh"         },
  { id: "tin-midnight", label: "Tin KiN" },
  { id: "kinh-nghiem",  label: "Kinh nghiệm thi"   },
];

const catColors: Record<Exclude<Category, "all">, { bg: string; color: string }> = {
  "hoc-thuat":   { bg: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" },
  "tuyen-sinh":  { bg: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" },
  "tin-midnight":{ bg: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" },
  "kinh-nghiem": { bg: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" },
};

const catLabels: Record<Exclude<Category, "all">, string> = {
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

export default function TinTucPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch]     = useState("");
  const [articles, setArticles]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState(false);

  function loadArticles() {
    setLoading(true);
    setFetchError(false);
    fetch("/api/articles")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setArticles(Array.isArray(data) ? data : []))
      .catch(() => { setArticles([]); setFetchError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadArticles(); }, []);

  const filtered = articles.filter((a) => {
    const matchCat = activeCategory === "all" || a.category === activeCategory;
    const matchSearch = search === "" ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const pinned = filtered.filter((a) => a.isPinned);
  const rest   = filtered.filter((a) => !a.isPinned);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>Tin tức & Blog</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--kin-chu-mo)" }}>Kiến thức tuyển sinh, kinh nghiệm học tập và tin tức mới nhất từ KiN</p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài viết..."
            className="notion-input w-full text-sm"
            style={{ color: "var(--kin-chu-chinh)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs cursor-pointer"
              style={{ color: "var(--kin-chu-mo)" }}>✕</button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveCategory(id)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              style={activeCategory === id
                ? { background: "var(--kin-nhan-nen)", color: "white", borderRadius: "8px" }
                : { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-6 animate-pulse" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <div className="h-4 w-24 rounded mb-3" style={{ background: "var(--kin-vien-thuong)" }} />
              <div className="h-6 w-3/4 rounded mb-2" style={{ background: "var(--kin-vien-thuong)" }} />
              <div className="h-4 w-full rounded mb-1" style={{ background: "var(--kin-vien-thuong)" }} />
              <div className="h-4 w-2/3 rounded" style={{ background: "var(--kin-vien-thuong)" }} />
            </div>
          ))}
        </div>
      )}

      {/* Fetch error */}
      {!loading && fetchError && (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Không thể tải bài viết</p>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Kiểm tra kết nối và thử lại</p>
          <button onClick={loadArticles}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--kin-nhan-nen)" }}>
            Thử lại
          </button>
        </div>
      )}

      {/* Empty / no results */}
      {!loading && !fetchError && filtered.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
            {articles.length === 0 ? "Chưa có bài viết nào" : "Không tìm thấy bài viết nào"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            {articles.length === 0 ? "Hãy quay lại sau nhé!" : "Thử từ khóa khác hoặc chọn danh mục khác"}
          </p>
        </div>
      )}

      {/* Articles */}
      {!loading && !fetchError && filtered.length > 0 && (
        <div className="space-y-6">
          {pinned.map((a) => <ArticleCardFeatured key={a.id} article={a} />)}
          <div className="grid sm:grid-cols-2 gap-4">
            {rest.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleCardFeatured({ article: a }: { article: Article }) {
  const cat = catColors[a.category] ?? { bg: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" };
  return (
    <Link href={`/tin-tuc/${a.slug}`}>
      <div className="rounded-xl p-6 cursor-pointer transition-colors hover:bg-[var(--kin-nen-bang)]"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex items-start gap-5">
          <div className="hidden sm:block w-1 self-stretch rounded-full flex-shrink-0" style={{ background: "var(--kin-nhan-nen)" }} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: cat.bg, color: cat.color }}>
                {catLabels[a.category] ?? a.category}
              </span>
              {a.tag && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ background: "var(--kin-nhan-nen)" }}>{a.tag}</span>
              )}
            </div>
            <h2 className="text-xl font-bold mb-2 leading-snug" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>{a.title}</h2>
            <p className="text-sm leading-relaxed mb-3 line-clamp-2" style={{ color: "var(--kin-chu-mo)" }}>{a.excerpt}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
              <span>{a.author}</span><span>·</span>
              <span>{formatDate(a.publishedAt ?? a.createdAt)}</span><span>·</span>
              <span>{a.readTime} phút đọc</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article: a }: { article: Article }) {
  const cat = catColors[a.category] ?? { bg: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" };
  return (
    <Link href={`/tin-tuc/${a.slug}`}>
      <div className="rounded-xl p-5 h-full cursor-pointer transition-colors hover:bg-[var(--kin-nen-bang)]"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cat.bg, color: cat.color }}>
            {catLabels[a.category] ?? a.category}
          </span>
          {a.tag && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>{a.tag}</span>
          )}
        </div>
        <h3 className="font-bold text-base leading-snug mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{a.title}</h3>
        <p className="text-xs leading-relaxed mb-3 line-clamp-3" style={{ color: "var(--kin-chu-mo)" }}>{a.excerpt}</p>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
          <span>{a.author}</span><span>·</span>
          <span>{formatDate(a.publishedAt ?? a.createdAt)}</span><span>·</span>
          <span>{a.readTime} phút</span>
        </div>
      </div>
    </Link>
  );
}
