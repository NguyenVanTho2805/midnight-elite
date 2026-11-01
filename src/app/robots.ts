// BU-07 mục 5.5 — robots.txt theo tên miền: tên miền admin cấm toàn bộ; tên miền chính chặn các đường riêng tư và trỏ tới sitemap.
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isAdminHost } from "@/lib/hostRouting";
import { siteUrl } from "@/lib/seoPublic";

export const dynamic = "force-dynamic";

export const ROBOTS_DISALLOW = ["/admin", "/api/", "/student", "/lop-cua-toi", "/phu-huynh", "/xem-tai-lieu", "/xac-", "/dat-lai-mat-khau"] as const;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (isAdminHost(host)) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }], sitemap: `${siteUrl()}/sitemap.xml` };
}
