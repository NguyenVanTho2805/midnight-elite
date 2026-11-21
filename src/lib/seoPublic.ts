// BU-07 mục 5.4 — metadata công khai (OG, canonical) cho Khoá học (SCL F1: phần Tin tức đã xoá). Không sửa layout.tsx: URL tuyệt đối ghép ở đây bằng siteUrl().
import type { Metadata } from "next";
import { MAIN_HOST } from "@/lib/hostRouting";
import { isReservedCourseId, RESERVED_COURSE_IDS } from "@/lib/courseIds";

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
