// BU-07 mục 5.5 — sơ đồ trang cho công cụ tìm kiếm. Chỉ trang công khai, bài ĐANG hiển thị (publicArticleWhere) và khoá học status=true.
// Không bao giờ có /admin, /api, /student, /lop-cua-toi, /phu-huynh, trang cần đăng nhập, /thi-thu.
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { listPublicArticleSlugs } from "@/lib/articlesPublic";
import { publicCourseWhere, siteUrl } from "@/lib/seoPublic";
import { featureOn, isLinkHidden } from "@/lib/features";

export const dynamic = "force-dynamic";

export const SITEMAP_MAX = 5000;
export const SITEMAP_STATIC = ["/", "/tin-tuc", "/khoa-hoc", "/giang-vien", "/diem-chuan", "/chinh-sach"] as const;
// LOI-01: trang của phần đang ẩn (src/lib/features.ts) không vào sơ đồ trang — route đó đang 307 về trang chủ.
export const sitemapStatic = (): string[] => SITEMAP_STATIC.filter(p => !isLinkHidden(p));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const tinh: MetadataRoute.Sitemap = sitemapStatic().map((p) => ({ url: base + (p === "/" ? "" : p) }));
  const con = SITEMAP_MAX - tinh.length;
  const [bai, khoa] = await Promise.all([
    featureOn("TIN_TUC") ? listPublicArticleSlugs(con, now) : Promise.resolve([]),
    prisma.course.findMany({ where: publicCourseWhere(), orderBy: { sortOrder: "asc" }, take: con, select: { id: true } }),
  ]);
  const out: MetadataRoute.Sitemap = [
    ...tinh,
    ...bai.map((a) => ({ url: `${base}/tin-tuc/${encodeURIComponent(a.slug)}`, lastModified: a.updatedAt })),
    ...khoa.map((c) => ({ url: `${base}/khoa-hoc/${encodeURIComponent(c.id)}` })),
  ];
  return out.slice(0, SITEMAP_MAX);
}
