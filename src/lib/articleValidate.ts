// ADM-002 — kiểm tra phía MÁY CHỦ cho bài viết (Tin tức), THUẦN (không DB). Dùng chung với biểu mẫu quản trị để hai bên nói cùng một luật.
// Luật (docs/kin/bao-cao/diem-yeu-01-11-2026.md, mục 4): slug khớp ^[a-z0-9-]{3,80}$ (và có ít nhất một chữ hoặc số), tiêu đề ≥ 10 ký tự, nội dung ≥ 100 ký tự.
// Đếm ký tự SAU KHI cắt khoảng trắng hai đầu; đếm theo ký tự hiển thị (NFC), không đếm byte.
import { SLUG_MAX } from "@/lib/articleSource";
import { toSlug } from "@/lib/slug";

export const SLUG_MIN = 3;
export const TITLE_MIN = 10;
export const CONTENT_MIN = 100;
export const SLUG_RE = new RegExp(`^[a-z0-9-]{${SLUG_MIN},${SLUG_MAX}}$`);

export type ArticleTextField = "title" | "slug" | "content";
export type ArticleTextError = { field: ArticleTextField; error: string };

const len = (s: string) => Array.from(s.normalize("NFC").trim()).length;

/** Slug đề xuất từ tiêu đề: cắt ở ranh giới từ cho khỏi dài quá SLUG_MAX (cùng cách `draftFromPaste`). Có thể ngắn hơn SLUG_MIN — khi đó người dùng phải nhập tay. */
export function toArticleSlug(title: string): string {
  const slug = toSlug(title);
  if (slug.length <= SLUG_MAX) return slug;
  const cut = slug.slice(0, SLUG_MAX);
  return cut.replace(/-[^-]*$/, "") || cut;
}

export function slugError(slug: unknown): string | null {
  if (typeof slug !== "string") return "Slug phải là chuỗi";
  const s = slug.trim();
  if (!SLUG_RE.test(s) || !/[a-z0-9]/.test(s)) return `Slug chỉ gồm chữ thường không dấu, số, gạch ngang; dài ${SLUG_MIN}–${SLUG_MAX} ký tự`;
  return null;
}
export function titleError(title: unknown): string | null {
  if (typeof title !== "string") return "Tiêu đề phải là chuỗi";
  return len(title) < TITLE_MIN ? `Tiêu đề phải có ít nhất ${TITLE_MIN} ký tự` : null;
}
export function contentError(content: unknown): string | null {
  if (typeof content !== "string") return "Nội dung phải là chuỗi";
  return len(content) < CONTENT_MIN ? `Nội dung phải có ít nhất ${CONTENT_MIN} ký tự` : null;
}

/**
 * Kiểm các trường CÓ MẶT trong `input` (khoá vắng = không kiểm, để PATCH một phần như chỉ đổi `published` không bị chặn vì bài cũ ngắn).
 * `slugChanged=false` thì bỏ qua slug (slug cũ không hợp lệ vẫn được giữ nguyên). Trả lỗi đầu tiên theo thứ tự tiêu đề → slug → nội dung.
 */
export function validateArticleText(input: { title?: unknown; slug?: unknown; content?: unknown }, opts: { slugChanged?: boolean } = {}): ArticleTextError | null {
  if (input.title !== undefined) { const e = titleError(input.title); if (e) return { field: "title", error: e }; }
  if (input.slug !== undefined && opts.slugChanged !== false) { const e = slugError(input.slug); if (e) return { field: "slug", error: e }; }
  if (input.content !== undefined) { const e = contentError(input.content); if (e) return { field: "content", error: e }; }
  return null;
}
