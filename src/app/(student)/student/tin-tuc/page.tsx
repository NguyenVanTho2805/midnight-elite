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
  date: string;
  readTime: number;
  isPinned?: boolean;
  tag?: string;
}

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "all",         label: "Tất cả" },
  { id: "hoc-thuat",   label: "Học thuật" },
  { id: "tuyen-sinh",  label: "Tuyển sinh" },
  { id: "tin-midnight",    label: "Tin Midnight Elite" },
  { id: "kinh-nghiem", label: "Kinh nghiệm" },
];

const ARTICLES: Article[] = [
  {
    id:"1", slug:"dgnl-hsa-2026-co-gi-moi", category:"tuyen-sinh", isPinned:true, tag:"Nổi bật",
    title:"ĐGNL HSA 2026 có gì mới? Tất cả thay đổi bạn cần biết",
    excerpt:"Bộ GD&ĐT vừa công bố những thay đổi quan trọng trong cấu trúc đề thi ĐGNL của Đại học Quốc gia Hà Nội năm 2026. Cùng Midnight Elite phân tích chi tiết.",
    author:"Thầy Minh", date:"24/05/2026", readTime:8,
  },
  {
    id:"2", slug:"bi-quyet-dat-900-diem-dgnl", category:"kinh-nghiem", tag:"Hot",
    title:"Bí quyết đạt 900+ điểm ĐGNL từ học sinh đạt điểm tuyệt đối 2025",
    excerpt:"Nguyễn Hữu Thắng — thủ khoa ĐGNL HSA 2025 với 1050/1200 điểm chia sẻ lộ trình 6 tháng ôn luyện, phân bổ thời gian và cách xử lý đề thi.",
    author:"Ban biên tập", date:"22/05/2026", readTime:12,
  },
  {
    id:"3", slug:"diem-chuan-dai-hoc-2026-du-bao", category:"tuyen-sinh",
    title:"Dự báo điểm chuẩn 2026: Các ngành hot tăng hay giảm?",
    excerpt:"Dựa trên tỷ lệ đăng ký xét tuyển và chỉ tiêu từng trường, Midnight Elite phân tích xu hướng điểm chuẩn năm 2026 cho các ngành Y, Luật, CNTT và Kinh tế.",
    author:"Cô Hương", date:"20/05/2026", readTime:10,
  },
  {
    id:"4", slug:"ME-mock-4-ket-qua", category:"tin-midnight", tag:"Mới",
    title:"Kết quả Kỳ thi thử ĐGNL Mock #4 — Top 10 học viên xuất sắc",
    excerpt:"Midnight Elite công bố kết quả kỳ thi thử Mock #4 với hơn 1.200 học viên tham gia. Điểm trung bình tăng 45 điểm so với Mock #3.",
    author:"Admin Midnight Elite", date:"18/05/2026", readTime:4,
  },
  {
    id:"5", slug:"phuong-phap-doc-hieu-tieng-anh-dgnl", category:"hoc-thuat",
    title:"Phương pháp đọc hiểu Tiếng Anh ĐGNL: Từ 30% lên 80% trong 8 tuần",
    excerpt:"Cô Lan — Giáo viên Tiếng Anh Midnight Elite hướng dẫn chiến lược làm bài đọc hiểu theo từng dạng câu hỏi, giúp học viên tiết kiệm thời gian và tránh bẫy đề.",
    author:"Cô Lan", date:"15/05/2026", readTime:9,
  },
  {
    id:"6", slug:"tsa-vs-dgnl-nen-chon-gi", category:"tuyen-sinh",
    title:"TSA vs ĐGNL HSA vs ĐGNL HCM: Nên chọn kỳ thi nào?",
    excerpt:"So sánh chi tiết 3 kỳ thi năng lực phổ biến nhất hiện nay về cấu trúc đề, trường xét tuyển, thời gian thi và độ khó.",
    author:"Thầy Long", date:"12/05/2026", readTime:11,
  },
  {
    id:"7", slug:"streak-hoc-tap-va-thanh-cong", category:"kinh-nghiem",
    title:"12 ngày học liên tiếp thay đổi não bộ như thế nào? Khoa học đứng sau streak",
    excerpt:"Nghiên cứu khoa học thần kinh chứng minh: 12 ngày học liên tiếp tạo ra thói quen thần kinh bền vững. Midnight Elite xây dựng hệ thống streak dựa trên nền tảng này.",
    author:"Ban biên tập", date:"08/05/2026", readTime:7,
  },
  {
    id:"8", slug:"ME-ra-mat-tinh-nang-ai-hoi-dap", category:"tin-midnight",
    title:"Midnight Elite ra mắt tính năng AI hỏi đáp 24/7 — Giải đáp mọi câu hỏi học thuật",
    excerpt:"Tính năng Q&A AI mới tích hợp Claude AI giúp học viên nhận giải đáp câu hỏi học thuật bất cứ lúc nào, kết hợp với đội ngũ mentor kiểm duyệt.",
    author:"Admin Midnight Elite", date:"05/05/2026", readTime:5,
  },
];

const catColors: Record<Exclude<Category,"all">,{ bg:string; color:string }> = {
  "hoc-thuat":  { bg:"#dbeafe", color:"#0068FF" },
  "tuyen-sinh": { bg:"#fee2e2", color:"#FF2157" },
  "tin-midnight":   { bg:"#d1fae5", color:"#00A63D" },
  "kinh-nghiem":{ bg:"#fef3c7", color:"#FE9900" },
};

const catLabels: Record<Exclude<Category,"all">,string> = {
  "hoc-thuat":  "Học thuật",
  "tuyen-sinh": "Tuyển sinh",
  "tin-midnight":   "Tin Midnight Elite",
  "kinh-nghiem":"Kinh nghiệm",
};

function ArticleCardFeatured({ article: a }: { article: Article }) {
  const cat = catColors[a.category];
  return (
    <Link href={`/tin-tuc/${a.slug}`}>
      <div className="rounded-xl p-6 cursor-pointer transition-colors hover:bg-[#fafafa]"
        style={{ background:"#ffffff", border:"1px solid #e5e3df" }}>
        <div className="flex items-start gap-5">
          <div className="hidden sm:block w-1 self-stretch rounded-full flex-shrink-0"
            style={{ background:"#0068FF" }} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:cat.bg, color:cat.color }}>
                {catLabels[a.category]}
              </span>
              {a.tag && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ background:"#0068FF" }}>{a.tag}</span>
              )}
            </div>
            <h2 className="text-xl font-extrabold mb-2 leading-snug" style={{ color:"#1E2938" }}>{a.title}</h2>
            <p className="text-sm leading-relaxed mb-3 line-clamp-2" style={{ color:"#4B5563" }}>{a.excerpt}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color:"#9CA3AF" }}>
              <span>{a.author}</span><span>·</span><span>{a.date}</span><span>·</span><span>{a.readTime} phút đọc</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article: a }: { article: Article }) {
  const cat = catColors[a.category];
  return (
    <Link href={`/tin-tuc/${a.slug}`}>
      <div className="rounded-xl p-5 h-full cursor-pointer transition-colors hover:bg-[#fafafa]"
        style={{ background:"#ffffff", border:"1px solid #e5e3df" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:cat.bg, color:cat.color }}>
            {catLabels[a.category]}
          </span>
          {a.tag && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:"#FEF3C7", color:"#FE9900" }}>{a.tag}</span>
          )}
        </div>
        <h3 className="font-extrabold text-base leading-snug mb-2" style={{ color:"#1E2938" }}>{a.title}</h3>
        <p className="text-xs leading-relaxed mb-3 line-clamp-3" style={{ color:"#6B7280" }}>{a.excerpt}</p>
        <div className="flex items-center gap-2 text-xs" style={{ color:"#9CA3AF" }}>
          <span>{a.author}</span><span>·</span><span>{a.date}</span><span>·</span><span>{a.readTime} phút</span>
        </div>
      </div>
    </Link>
  );
}

export default function StudentTinTucPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    fetch("/api/articles?published=true&limit=50")
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(d => setArticles(d.articles ?? []))
      .catch(() => setArticles(ARTICLES))
      .finally(() => setLoadingArticles(false));
  }, []);

  const source = articles.length > 0 ? articles : ARTICLES;

  const filtered = source.filter(a => {
    const matchCat    = activeCategory === "all" || a.category === activeCategory;
    const matchSearch = search === "" || a.title.toLowerCase().includes(search.toLowerCase()) || a.excerpt.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const pinned = filtered.filter(a => a.isPinned);
  const rest   = filtered.filter(a => !a.isPinned);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color:"#1E2938" }}>Tin tức &amp; Blog</h1>
        <p className="mt-1 text-sm" style={{ color:"#6B7280" }}>Kiến thức tuyển sinh, kinh nghiệm học tập và tin tức mới nhất từ Midnight Elite</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài viết..."
            className="notion-input w-full text-sm"
            style={{ color:"#37352f" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-lg"
              style={{ color:"#9CA3AF" }}>✕</button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveCategory(id)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={activeCategory === id
                ? { background:"#0068FF", color:"white", borderRadius:"8px" }
                : { background:"#ffffff", border:"1px solid #e5e3df", color:"#787671", borderRadius:"8px" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadingArticles ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background:"#f6f5f4", border:"1px solid #e5e3df" }}>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background:"#f6f5f4", border:"1px solid #e5e3df" }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-semibold" style={{ color:"#1E2938" }}>Không tìm thấy bài viết nào</p>
          <p className="text-sm mt-1" style={{ color:"#9CA3AF" }}>Thử từ khóa khác hoặc chọn danh mục khác</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.map(a => <ArticleCardFeatured key={a.id} article={a} />)}
          <div className="grid sm:grid-cols-2 gap-4">
            {rest.map(a => <ArticleCard key={a.id} article={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
