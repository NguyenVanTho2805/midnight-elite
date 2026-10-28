// Nguồn + ảnh bìa của bài Tin tức, và "dán nhanh" từ bài đăng Facebook (NC2-051, góp ý 28/10: "gửi 1 bài đăng fb thì nó render ra như 1 bài báo").
// THUẦN: không DB, không React. Test: tools/local-e2e/t-article-source-lib.ts.
//
// Giai đoạn 1 (mặc định Q19): quản trị DÁN nội dung bài Facebook của chính mình + link bài gốc; KiN chỉ đổi chữ dán thành tiêu đề / tóm tắt / nội dung rồi ghi nguồn.
// KHÔNG quét trang Facebook (vi phạm điều khoản); nối Graph API là giai đoạn 2, chưa làm.
import { cleanSourceUrl, sourceNameFromUrl } from "@/lib/admissionScore";
import { toSlug } from "@/lib/slug";

export const SOURCE_NAME_MAX = 80;
/** Link ảnh của Facebook / CDN thường dài hơn link bài, nên cho rộng hơn giới hạn 500 của link nguồn. */
export const COVER_URL_MAX = 1000;
export const TITLE_MAX = 120;
export const EXCERPT_MAX = 250;
export const SLUG_MAX = 80;

export interface ArticleSourceValue { sourceUrl: string | null; sourceName: string | null; coverImage: string | null }
/** `field` = ô bị lỗi, để form hiện lời báo đúng chỗ. */
export type ArticleSourceCheck = { ok: true; value: ArticleSourceValue } | { ok: false; error: string; field: keyof ArticleSourceValue };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
// NFC: chữ có dấu dán từ Mac / Facebook có thể ở dạng tổ hợp (NFD).
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200d\u2060\ufeff]/g, " ").replace(/\s+/g, " ").trim() : "");

/**
 * Kiểm nguồn + ảnh bìa từ dữ liệu thô (JSON do trình duyệt gửi, KHÔNG tin). Trống = không có.
 * - sourceUrl: chỉ http(s), không kèm tên đăng nhập (chặn javascript:, ftp:, https://tin-cay.vn@xau.com).
 * - sourceName: tên hiển thị; để trống thì lấy tên miền. Không có link nguồn thì không có tên nguồn (tên chỉ là nhãn của link).
 * - coverImage: chỉ https (không http, không data:), tối đa COVER_URL_MAX ký tự.
 */
export function cleanArticleSource(raw: { sourceUrl?: unknown; sourceName?: unknown; coverImage?: unknown }): ArticleSourceCheck {
  let sourceUrl: string | null = null;
  if (!blank(raw.sourceUrl)) {
    sourceUrl = cleanSourceUrl(raw.sourceUrl);
    if (!sourceUrl) return { ok: false, field: "sourceUrl", error: "Đường dẫn nguồn không hợp lệ (chỉ nhận http/https, không kèm tên đăng nhập, tối đa 500 ký tự)" };
  }

  let sourceName: string | null = null;
  if (sourceUrl) {
    const name = oneLine(raw.sourceName);
    if (name.length > SOURCE_NAME_MAX) return { ok: false, field: "sourceName", error: `Tên nguồn tối đa ${SOURCE_NAME_MAX} ký tự` };
    sourceName = name || sourceNameFromUrl(sourceUrl) || null;
  }

  let coverImage: string | null = null;
  if (!blank(raw.coverImage)) {
    const u = cleanSourceUrl(raw.coverImage, COVER_URL_MAX);
    if (!u || !u.startsWith("https://")) return { ok: false, field: "coverImage", error: `Ảnh bìa phải là đường dẫn https (tối đa ${COVER_URL_MAX} ký tự)` };
    coverImage = u;
  }
  return { ok: true, value: { sourceUrl, sourceName, coverImage } };
}

export interface PasteDraft { title: string; slug: string; excerpt: string; content: string; readTime: number }

/** Cắt ở ranh giới từ, thêm "…" khi phải cắt; kết quả KHÔNG dài hơn `max`. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).trimEnd() + "…";
}

/** Chuẩn hoá chữ dán: NFC, tab → khoảng trắng (không để hai từ dính nhau), bỏ ký tự điều khiển / tàng hình (giữ đổi dòng), CRLF → LF, bỏ khoảng trắng cuối dòng, tối đa một dòng trống liên tiếp. */
export function normalizePasted(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[\u0000-\u0009\u000b-\u001f\u007f\u200b\ufeff]/g, "")
    .replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Từ chữ dán của một bài đăng Facebook, đề xuất tiêu đề / tóm tắt / nội dung để quản trị SỬA TRƯỚC KHI lưu (không tự đăng).
 * Dòng đầu là tiêu đề nếu ngắn (≤ TITLE_MAX); phần còn lại là nội dung. Dòng đầu quá dài (bài chỉ một đoạn) thì tiêu đề là phần đầu của nó
 * (cắt ở ranh giới từ) và nội dung là toàn bộ chữ dán. Trả null khi không có chữ nào.
 */
export function draftFromPaste(text: string): PasteDraft | null {
  const t = normalizePasted(typeof text === "string" ? text : "");
  if (!t) return null;
  const nl = t.indexOf("\n");
  const first = (nl === -1 ? t : t.slice(0, nl)).trim();
  const rest = nl === -1 ? "" : t.slice(nl + 1).trim();

  const short = first.length <= TITLE_MAX;
  const title = short ? first : clip(first, TITLE_MAX);
  const content = short && rest ? rest : t;

  const excerpt = clip(content.replace(/\s+/g, " ").trim(), EXCERPT_MAX);
  const words = content.split(/\s+/).filter(Boolean).length;
  const readTime = Math.min(60, Math.max(1, Math.ceil(words / 200)));
  let slug = toSlug(title);
  if (slug.length > SLUG_MAX) slug = slug.slice(0, SLUG_MAX).replace(/-[^-]*$/, "") || slug.slice(0, SLUG_MAX);
  return { title, slug, excerpt, content, readTime };
}
