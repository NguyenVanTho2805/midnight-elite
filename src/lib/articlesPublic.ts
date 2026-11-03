// BU-07 — nguồn sự thật DUY NHẤT cho mọi đường ĐỌC CÔNG KHAI của Tin tức (API, trang, sitemap). Spec: docs/kin/phong-ban/dac-ta/BU-07.md mục 2, 4.
// Quy tắc: bài chỉ hiện khi published=true VÀ (publishedAt null HOẶC <= now). `now` luôn là giờ máy chủ, không nhận từ yêu cầu.
// Phần thuần (hằng, publicArticleWhere, isArticleVisible, categoryGroupOf, isValidMuc, shapeCover) test ở tools/local-e2e/t-articles-lib.ts.
import { prisma } from "@/lib/prisma";
import { cleanArticleSource, COVER_URL_MAX } from "@/lib/articleSource";

// ───────────── Chuyên mục

export interface ArticleBlock { key: string; label: string; /** Giá trị `?muc=` của khối (cũng là category chính). */ muc: string }
/** 4 khối trên trang /tin-tuc, đúng thứ tự hiển thị. */
export const ARTICLE_BLOCKS: readonly ArticleBlock[] = [
  { key: "tuyen-sinh", label: "Tuyển sinh", muc: "tuyen-sinh" },
  { key: "hoc-tap", label: "Học tập", muc: "hoc-thuat" },
  { key: "kin", label: "KiN", muc: "tin-midnight" },
  { key: "gia-su", label: "Gia sư", muc: "gia-su" },
];

export interface ArticleCategory { value: string; label: string; /** key của ARTICLE_BLOCKS */ group: string }
/** Giá trị `category` lưu trong DB (giữ nguyên tên cũ, không di trú). `kinh-nghiem` nằm trong khối Học tập. */
export const ARTICLE_CATEGORIES: readonly ArticleCategory[] = [
  { value: "tuyen-sinh", label: "Tuyển sinh", group: "tuyen-sinh" },
  { value: "hoc-thuat", label: "Học tập", group: "hoc-tap" },
  { value: "kinh-nghiem", label: "Kinh nghiệm thi", group: "hoc-tap" },
  { value: "tin-midnight", label: "KiN", group: "kin" },
  { value: "gia-su", label: "Gia sư", group: "gia-su" },
];

/** Khối của một category; chuỗi lạ → null. */
export function categoryGroupOf(value: unknown): ArticleBlock | null {
  if (typeof value !== "string") return null;
  const c = ARTICLE_CATEGORIES.find(x => x.value === value);
  return c ? ARTICLE_BLOCKS.find(b => b.key === c.group) ?? null : null;
}
/** Nhãn hiển thị; category lạ → "Tin tức". */
export function categoryLabel(value: unknown): string {
  return ARTICLE_CATEGORIES.find(x => x.value === value)?.label ?? "Tin tức";
}
/** `muc` hợp lệ = một giá trị của ARTICLE_CATEGORIES (so khớp CHÍNH XÁC, không quy đổi). `all`/trống không phải "muc". */
export function isValidMuc(s: unknown): s is string {
  return typeof s === "string" && ARTICLE_CATEGORIES.some(c => c.value === s);
}
/** Các category mà một `muc` lấy: muc là category chính của khối → cả khối (hoc-thuat gồm cả kinh-nghiem); ngược lại chỉ chính nó. */
export function categoriesForMuc(muc: string): string[] {
  const block = ARTICLE_BLOCKS.find(b => b.muc === muc);
  return block ? ARTICLE_CATEGORIES.filter(c => c.group === block.key).map(c => c.value) : [muc];
}

// ───────────── Điều kiện hiển thị

/** Bài hiển thị cho khách: đã đăng và (không có giờ đăng — bài cũ — hoặc giờ đăng đã tới). Biên `lte`: đúng `now` thì hiện. */
export function publicArticleWhere(now: Date = new Date()) {
  return { published: true, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
}
/** Bản thuần của publicArticleWhere, cho test và cho chỗ đã có bài trong tay. PHẢI khớp publicArticleWhere. */
export function isArticleVisible(a: { published: boolean; publishedAt: Date | null }, now: Date = new Date()): boolean {
  return a.published === true && (a.publishedAt === null || a.publishedAt.getTime() <= now.getTime());
}

// ───────────── Hình dạng trả về

export interface ArticleCard {
  id: string; slug: string; title: string; excerpt: string;
  category: string; categoryLabel: string; author: string; tag: string | null;
  isPinned: boolean; readTime: number; views: number;
  publishedAt: Date | null; createdAt: Date;
  coverImage: string | null; coverCaption: string | null;
}
export interface ArticleFull extends ArticleCard { content: string; sourceUrl: string | null; sourceName: string | null }

export const CAPTION_MAX = 200;
const oneLine = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim() : "");

/**
 * Chạy `cleanArticleSource` trên MỌI hàng đọc ra: dữ liệu sửa tay lạ → bỏ coverImage / sourceUrl (+ sourceName). Cũng làm sạch coverCaption (một dòng, ≤200).
 * Ảnh bìa và nguồn được kiểm CHUNG (khớp t-article-source): một phần sai thì bỏ cả bộ.
 */
export function shapeCover<T extends { coverImage?: string | null; coverCaption?: string | null; sourceUrl?: string | null; sourceName?: string | null }>(row: T): T {
  const out = { ...row };
  // NC2-051 (t-article-source): bộ ba nguồn + ảnh bìa được kiểm CHUNG; một phần sai thì bỏ cả bộ (an toàn hơn đoán phần nào dùng được).
  if ("coverImage" in out || "sourceUrl" in out || "sourceName" in out) {
    const c = cleanArticleSource({ sourceUrl: out.sourceUrl, sourceName: out.sourceName, coverImage: out.coverImage });
    if ("coverImage" in out) out.coverImage = c.ok ? c.value.coverImage : null;
    if ("sourceUrl" in out) out.sourceUrl = c.ok ? c.value.sourceUrl : null;
    if ("sourceName" in out) out.sourceName = c.ok ? c.value.sourceName : null;
  }
  if ("coverCaption" in out) {
    const cap = oneLine(out.coverCaption).slice(0, CAPTION_MAX);
    out.coverCaption = cap || null;
  }
  return out;
}

const CARD_SELECT = {
  id: true, slug: true, title: true, excerpt: true, category: true, author: true, tag: true,
  isPinned: true, readTime: true, views: true, publishedAt: true, createdAt: true,
  coverImage: true, coverCaption: true,
} as const;
const FULL_SELECT = { ...CARD_SELECT, content: true, sourceUrl: true, sourceName: true } as const;

type CardRow = { id: string; slug: string; title: string; excerpt: string; category: string; author: string; tag: string | null; isPinned: boolean; readTime: number; views: number; publishedAt: Date | null; createdAt: Date; coverImage: string | null; coverCaption: string | null };
function toCard(row: CardRow): ArticleCard {
  const s = shapeCover(row);
  return { ...s, categoryLabel: categoryLabel(s.category) };
}

// ───────────── Truy vấn

export const MOST_READ_WINDOW_DAYS = 60;
export type ArticleSort = "moi" | "xem-nhieu";
export const LIST_LIMIT_MAX = 50;

const ORDER_MOI = [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }] as const;
const ORDER_XEM_NHIEU = [{ views: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }] as const;

export interface ListOpts {
  /** Phải đã qua isValidMuc (hoặc category cũ); trống = tất cả. */
  muc?: string; limit: number; sort: ArticleSort; excludeSlug?: string; now?: Date;
  /** Trang ≥1 (mặc định 1) → skip. */
  trang?: number;
}

export async function listPublicArticles(o: ListOpts): Promise<ArticleCard[]> {
  const now = o.now ?? new Date();
  const limit = Math.min(Math.max(Math.trunc(o.limit) || 1, 1), LIST_LIMIT_MAX);
  const page = Math.max(Math.trunc(o.trang ?? 1) || 1, 1);
  const and: Record<string, unknown>[] = [publicArticleWhere(now)];
  if (o.muc) and.push({ category: { in: categoriesForMuc(o.muc) } });
  if (o.excludeSlug) and.push({ slug: { not: o.excludeSlug } });
  if (o.sort === "xem-nhieu") {
    // Chỉ bài ≤ 60 ngày để "Xem nhiều" không bị bài cũ chiếm mãi. Bài cũ không có giờ đăng tính theo ngày tạo.
    const since = new Date(now.getTime() - MOST_READ_WINDOW_DAYS * 86400000);
    and.push({ OR: [{ publishedAt: { gte: since } }, { publishedAt: null, createdAt: { gte: since } }] });
  }
  const rows = await prisma.article.findMany({
    where: { AND: and },
    orderBy: (o.sort === "xem-nhieu" ? ORDER_XEM_NHIEU : ORDER_MOI) as never,
    take: limit, skip: (page - 1) * limit,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** NUL làm Postgres báo lỗi (thành 500); slug thật không bao giờ dài hơn mức này. Không kiểm tồn tại. */
export function isPlausibleSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 200 && !slug.includes("\u0000");
}

/** Một bài đang hiển thị; không có / nháp / lên lịch tương lai / slug lạ → null (KHÔNG phân biệt). Không tăng lượt xem. */
export async function getPublicArticleBySlug(slug: unknown, now: Date = new Date()): Promise<ArticleFull | null> {
  if (!isPlausibleSlug(slug)) return null;
  const row = await prisma.article.findFirst({ where: { slug, ...publicArticleWhere(now) }, select: FULL_SELECT });
  if (!row) return null;
  const s = shapeCover(row);
  return { ...s, categoryLabel: categoryLabel(s.category) };
}

export function mostRead(n = 5, now: Date = new Date()): Promise<ArticleCard[]> {
  return listPublicArticles({ limit: n, sort: "xem-nhieu", now });
}

/** Tin liên quan: cùng mục (trừ chính bài), thiếu thì lấp bằng bài mới nhất mục khác. Tối đa n, không trùng, không chứa chính bài. */
export async function getRelated(article: { slug: string; category: string }, n = 4, now: Date = new Date()): Promise<ArticleCard[]> {
  const same = await listPublicArticles({ muc: article.category, limit: n, sort: "moi", excludeSlug: article.slug, now });
  if (same.length >= n) return same;
  const have = new Set(same.map(a => a.slug));
  have.add(article.slug);
  const others = await listPublicArticles({ limit: Math.min(n + same.length + 1, LIST_LIMIT_MAX), sort: "moi", excludeSlug: article.slug, now });
  for (const a of others) {
    if (same.length >= n) break;
    if (!have.has(a.slug)) { have.add(a.slug); same.push(a); }
  }
  return same;
}

export interface HomeBlock { block: ArticleBlock; /** Bài lớn đầu khối. */ lead: ArticleCard; /** Tối đa 3 bài phụ. */ items: ArticleCard[] }
export interface HomeBlocks {
  /** Bài ghim mới nhất; không ghim → bài mới nhất. null = chưa có bài nào. */
  featured: ArticleCard | null;
  /** 5 bài kế theo thứ tự `moi`, không lặp featured. */
  secondary: ArticleCard[];
  /** Chỉ các khối CÓ bài, theo thứ tự ARTICLE_BLOCKS; một bài chỉ xuất hiện một lần trên cả trang. */
  blocks: HomeBlock[];
  /** 5 bài "Xem nhiều" (độc lập với dedupe ở trên). */
  mostRead: ArticleCard[];
  empty: boolean;
}

export async function getHomeBlocks(now: Date = new Date()): Promise<HomeBlocks> {
  const [hero, perBlock, most] = await Promise.all([
    listPublicArticles({ limit: 6, sort: "moi", now }),
    Promise.all(ARTICLE_BLOCKS.map(b => listPublicArticles({ muc: b.muc, limit: 12, sort: "moi", now }))),
    mostRead(5, now),
  ]);
  const featured = hero[0] ?? null;
  const secondary = hero.slice(1, 6);
  const used = new Set(hero.map(a => a.slug));
  const blocks: HomeBlock[] = [];
  ARTICLE_BLOCKS.forEach((block, i) => {
    // Ưu tiên bài chưa lên khối nổi bật / cột phụ; nếu mục ít bài đến mức hết sạch thì vẫn hiện bài của mục (trừ bài nổi bật), kẻo mục có bài mà khối biến mất.
    let fresh = perBlock[i].filter(a => !used.has(a.slug)).slice(0, 4);
    if (fresh.length === 0) fresh = perBlock[i].filter(a => a.slug !== featured?.slug).slice(0, 4);
    if (fresh.length === 0) return;
    fresh.forEach(a => used.add(a.slug));
    blocks.push({ block, lead: fresh[0], items: fresh.slice(1) });
  });
  return { featured, secondary, blocks, mostRead: most, empty: featured === null };
}

/** Mọi bài hiển thị cho sitemap (slug + updatedAt), cắt ở `max`. */
export async function listPublicArticleSlugs(max: number, now: Date = new Date()): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.article.findMany({ where: publicArticleWhere(now), orderBy: [{ updatedAt: "desc" }], take: max, select: { slug: true, updatedAt: true } });
}

export { COVER_URL_MAX };

// ───────────── Dùng cho API quản trị (kiểm đầu vào ở đúng một nơi, test thuần)

export type CaptionCheck = { ok: true; value: string | null } | { ok: false; error: string };
/** Chú thích ảnh bìa: trống → null; phải là chuỗi; gộp về một dòng, ≤200 ký tự (quá → lỗi, không cắt thầm). Văn bản thuần (React thoát ký tự khi hiện). */
export function cleanCoverCaption(raw: unknown): CaptionCheck {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Chú thích ảnh phải là chữ" };
  const t = oneLine(raw);
  if (t.length > CAPTION_MAX) return { ok: false, error: `Chú thích ảnh tối đa ${CAPTION_MAX} ký tự` };
  return { ok: true, value: t || null };
}

export const SCHEDULE_RANGE_MS = 2 * 366 * 86400000;
export const SCHEDULE_PAST_GRACE_MS = 5 * 60000;
export type ScheduleCheck = { ok: true; value: Date | null } | { ok: false; error: string };
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Giờ đăng. Trống → null. Chuỗi KHÔNG có múi giờ (ô datetime-local của form) hiểu là giờ Việt Nam (+07:00), không phải giờ máy chủ.
 * Ngoài ±2 năm quanh `now` → lỗi. (Việc "không được ở quá khứ quá 5 phút" kiểm riêng bằng checkNotPast, vì sửa bài cũ gửi lại giờ cũ là hợp lệ.)
 */
export function parseSchedule(raw: unknown, now: Date = new Date()): ScheduleCheck {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: null };
  const bad = { ok: false as const, error: "Giờ đăng không hợp lệ" };
  if (typeof raw !== "string") return bad;
  const s = raw.trim();
  const m = ISO_RE.exec(s);
  if (!m) return bad;
  let iso = s.replace(" ", "T");
  if (!iso.includes("T")) iso += "T00:00:00";
  if (!m[1]) iso += "+07:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return bad;
  // Date tự cuốn ngày không có thật (30/02 → 02/03): kiểm ngày ≤ số ngày của tháng, kể cả khi có múi giờ.
  const [yy, mm, dd] = [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];
  if (mm < 1 || mm > 12 || dd < 1 || dd > new Date(Date.UTC(yy, mm, 0)).getUTCDate()) return bad;
  if (Math.abs(d.getTime() - now.getTime()) > SCHEDULE_RANGE_MS) return { ok: false, error: "Giờ đăng phải nằm trong khoảng 2 năm quanh hôm nay" };
  return { ok: true, value: d };
}
/** Đặt giờ đăng vào quá khứ xa (> 5 phút) khi bật xuất bản là nhầm; cho 5 phút châu để đồng hồ lệch. */
export const checkNotPast = (d: Date, now: Date = new Date()): boolean => d.getTime() >= now.getTime() - SCHEDULE_PAST_GRACE_MS;
