// BU-07 mục 5.4 — metadata công khai (OG, canonical, JSON-LD) cho Tin tức và Khoá học. Không sửa layout.tsx: URL tuyệt đối ghép ở đây bằng siteUrl().
import type { Metadata } from "next";
import { MAIN_HOST } from "@/lib/hostRouting";
import { isReservedCourseId, RESERVED_COURSE_IDS } from "@/lib/courseIds";
import { categoryLabel, isValidMuc } from "@/lib/articlesPublic";
import { cleanArticleSource } from "@/lib/articleSource";

export const OG_FALLBACK = "/og-kin.png";
export const DESCRIPTION_MAX = 155;

/** Gốc URL công khai, không có "/" cuối. */
export const siteUrl = (): string => `https://${MAIN_HOST}`;
/** Ghép đường dẫn tương đối vào gốc; đường dẫn đã tuyệt đối (https) giữ nguyên; thứ khác (javascript:, //host) → null. */
export function absoluteUrl(p: string): string | null {
  if (p.startsWith("https://")) return p;
  if (p.startsWith("/") && !p.startsWith("//")) return siteUrl() + p;
  return null;
}

/** Cắt ≤ max ở ranh giới từ, thêm "…". Gộp khoảng trắng. */
export function clipText(s: string, max = DESCRIPTION_MAX): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).trimEnd() + "…";
}

/** JSON-LD an toàn để nhúng trong <script type="application/ld+json">: thoát `<` (chặn </script>), U+2028/2029. */
export function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export interface ArticleMetaInput {
  slug: string; title: string; excerpt: string; category: string; author?: string;
  coverImage?: string | null; publishedAt?: Date | null; createdAt?: Date; updatedAt?: Date;
}
function articleImage(a: ArticleMetaInput): string {
  const c = cleanArticleSource({ coverImage: a.coverImage });
  return (c.ok && c.value.coverImage) || siteUrl() + OG_FALLBACK;
}

/** Title = tiêu đề (+ " — KiN" nếu cả chuỗi ≤60). */
export function articleTitle(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return (t + " — KiN").length <= 60 ? t + " — KiN" : t;
}

export function articleMetadata(a: ArticleMetaInput): Metadata {
  const url = `${siteUrl()}/tin-tuc/${encodeURIComponent(a.slug)}`;
  const desc = clipText(a.excerpt);
  const published = a.publishedAt ?? a.createdAt ?? undefined;
  return {
    title: articleTitle(a.title),
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "article", url, title: a.title, description: desc, siteName: "KiN",
      section: categoryLabel(a.category),
      ...(published ? { publishedTime: published.toISOString() } : {}),
      images: [articleImage(a)],
    },
  };
}
export const articleNotFoundMetadata = (): Metadata => ({ title: "Không tìm thấy bài viết — KiN", robots: { index: false, follow: false } });

export function articleJsonLd(a: ArticleMetaInput): Record<string, unknown> {
  const published = a.publishedAt ?? a.createdAt;
  return {
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: clipText(a.title, 110), description: clipText(a.excerpt),
    image: [articleImage(a)],
    ...(published ? { datePublished: published.toISOString() } : {}),
    ...(a.updatedAt ? { dateModified: a.updatedAt.toISOString() } : {}),
    author: { "@type": "Organization", name: !a.author || a.author === "Admin" ? "KiN" : a.author },
    publisher: { "@type": "Organization", name: "KiN" },
    mainEntityOfPage: `${siteUrl()}/tin-tuc/${encodeURIComponent(a.slug)}`,
  };
}

/** Metadata danh sách /tin-tuc; `muc` lạ → coi như tất cả, canonical về /tin-tuc. `trang>1` canonical về chính nó. */
export function newsListMetadata(muc?: string | null, trang = 1): Metadata {
  const valid = isValidMuc(muc);
  const base = valid ? `${siteUrl()}/tin-tuc?muc=${muc}` : `${siteUrl()}/tin-tuc`;
  const url = trang > 1 ? `${base}${valid ? "&" : "?"}trang=${trang}` : base;
  const title = valid ? `${categoryLabel(muc)} — Tin tức KiN` : "Tin tức tuyển sinh, học tập — KiN";
  const description = "Tin tuyển sinh, kinh nghiệm học và thi, thông báo từ KiN và gia sư — ghi rõ nguồn, cập nhật thường xuyên.";
  return { title, description, alternates: { canonical: url }, openGraph: { type: "website", url, title, description, siteName: "KiN", images: [siteUrl() + OG_FALLBACK] } };
}

/** Khoá học hiển thị công khai (cho sitemap và metadata): status=true và mã không trùng trang cố định. */
export const publicCourseWhere = () => ({ status: true, id: { notIn: [...RESERVED_COURSE_IDS] } });

export interface CourseMetaInput { id: string; name: string; instructor?: string | null; status: boolean }
/** Khoá ẩn / mã dành riêng → noindex. Mô tả chỉ gồm tên lớp + giáo viên (không link Zalo/học online, không giá). */
export function courseMetadata(c: CourseMetaInput | null): Metadata {
  if (!c || !c.status || isReservedCourseId(c.id)) return { title: "Khoá học — KiN", robots: { index: false, follow: false } };
  const url = `${siteUrl()}/khoa-hoc/${encodeURIComponent(c.id)}`;
  const description = clipText(c.instructor ? `${c.name} — giáo viên ${c.instructor}, học cùng KiN.` : `${c.name} — học cùng KiN.`);
  return {
    title: `${c.name} — KiN`, description, alternates: { canonical: url },
    openGraph: { type: "website", url, title: c.name, description, siteName: "KiN", images: [siteUrl() + OG_FALLBACK] },
  };
}
