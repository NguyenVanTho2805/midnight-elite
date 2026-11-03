// BU-05 — phần THUẦN của feed hợp nhất (không prisma): con trỏ mờ, điều kiện "sau con trỏ" cho từng nguồn, hợp nhất hai nguồn,
// ánh xạ hàng DB → FeedItem, dựng cây trả lời 1 cấp.
// Thứ tự toàn cục (ổn định, không mất không lặp): createdAt GIẢM DẦN → nguồn ("t" trước "q") → id GIẢM DẦN.
import type { FeedAuthor, FeedItem, ReplyNode } from "@/lib/communityTypes";
import { authorTag, publicName, type NameSource } from "@/lib/communityRules";

// ─── Con trỏ ─────────────────────────────────────────────────────────────────

export type FeedCursor = { at: Date; source: "thread" | "question"; id: string };
const MAX_CURSOR_LEN = 200;
const KEY_RE = /^([tq]):([A-Za-z0-9_-]{1,64})$/;

export const feedKey = (source: "thread" | "question", id: string) => `${source === "thread" ? "t" : "q"}:${id}`;

export function encodeCursor(item: { createdAt: string | Date; source: "thread" | "question"; id: string }): string {
  const iso = (item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt)).toISOString();
  return Buffer.from(`${iso}|${feedKey(item.source, item.id)}`, "utf8").toString("base64url");
}

// Trả null cho mọi đầu vào sai (không ném lỗi).
export function decodeCursor(raw: string | null | undefined): FeedCursor | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_CURSOR_LEN) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  let text: string;
  try { text = Buffer.from(raw, "base64url").toString("utf8"); } catch { return null; }
  const bar = text.indexOf("|");
  if (bar <= 0) return null;
  const iso = text.slice(0, bar);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso)) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || at.toISOString() !== iso) return null;
  const m = KEY_RE.exec(text.slice(bar + 1));
  if (!m) return null;
  return { at, source: m[1] === "t" ? "thread" : "question", id: m[2] };
}

const rank = (s: "thread" | "question") => (s === "thread" ? 0 : 1);

// Điều kiện Prisma-hình-dạng: các hàng của nguồn `source` nằm SAU con trỏ theo thứ tự toàn cục.
//  • nguồn đứng TRƯỚC nguồn của con trỏ (vd con trỏ ở "q", xét "t"): hàng cùng mili-giây đã đi qua → chỉ lấy createdAt < at.
//  • cùng nguồn: createdAt < at, hoặc cùng at và id < id con trỏ.
//  • nguồn đứng SAU (vd con trỏ ở "t", xét "q"): hàng cùng mili-giây chưa đi qua → lấy createdAt <= at.
export function sourceCursorWhere(
  cursor: FeedCursor | null,
  source: "thread" | "question",
): Record<string, unknown> {
  if (!cursor) return {};
  const r = rank(source), rc = rank(cursor.source);
  if (r < rc) return { createdAt: { lt: cursor.at } };
  if (r === rc) return { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] };
  return { createdAt: { lte: cursor.at } };
}

// ─── Hợp nhất ────────────────────────────────────────────────────────────────

type Orderable = { createdAt: string; source: "thread" | "question"; id: string };

export function compareFeed(a: Orderable, b: Orderable): number {
  const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
  if (ta !== tb) return tb - ta;
  if (a.source !== b.source) return rank(a.source) - rank(b.source);
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// Mỗi danh sách đã sắp theo compareFeed và lấy limit+1 từ nguồn. Trả `limit` mục đầu + con trỏ nếu còn nữa.
export function mergeFeedPages<T extends Orderable>(lists: T[][], limit: number): { items: T[]; nextCursor: string | null } {
  const all = lists.flat().sort(compareFeed);
  const seen = new Set<string>();
  const uniq: T[] = [];
  for (const it of all) {
    const k = feedKey(it.source, it.id);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  const items = uniq.slice(0, limit);
  const more = uniq.length > limit;
  return { items, nextCursor: more && items.length ? encodeCursor(items[items.length - 1]) : null };
}

// ─── Ánh xạ hàng DB → FeedItem ───────────────────────────────────────────────

export type AuthorRow = NameSource & { id: string; profileLockedAt?: Date | null };

export function toFeedAuthor(u: AuthorRow, guestName?: string | null): FeedAuthor {
  if (guestName) return { id: null, label: guestName, tag: "khach", href: null };
  const tag = authorTag(u);
  const linkable = tag === "gia-su" && !u.profileLockedAt;
  return { id: u.id, label: publicName(u), tag, href: linkable ? `/cong-dong/ho-so/${u.id}` : null };
}

export type ThreadRow = {
  id: string; kind: string; title: string | null; content: string; category: string;
  imageUrls: string[]; fileUrl: string | null; fileName: string | null;
  createdAt: Date; isPinned: boolean; guestName: string | null; acceptedReplyId: string | null;
  authorId: string; author: AuthorRow;
  course: { id: string; name: string } | null;
  _count: { replies: number; likes: number };
  likes: { userId: string }[]; bookmarks: { userId: string }[];
};

export function threadToFeedItem(t: ThreadRow, viewerId: string | null): FeedItem {
  const kind = t.kind === "question" ? "question" : "post";
  return {
    key: feedKey("thread", t.id), source: "thread", kind, id: t.id,
    title: kind === "question" ? t.title : null,
    content: t.content, category: t.category, imageUrls: t.imageUrls, fileUrl: t.fileUrl, fileName: t.fileName,
    createdAt: t.createdAt.toISOString(), isPinned: t.isPinned, course: t.course,
    author: toFeedAuthor(t.author, t.guestName),
    likeCount: t._count.likes, replyCount: t._count.replies,
    likedByMe: !!viewerId && t.likes.some(l => l.userId === viewerId),
    bookmarkedByMe: !!viewerId && t.bookmarks.some(b => b.userId === viewerId),
    isOwn: !!viewerId && t.authorId === viewerId,
    answered: kind === "question" && !!t.acceptedReplyId,
    href: `/cong-dong/${t.id}`,
  };
}

export type LegacyQuestionRow = {
  id: string; title: string; content: string; createdAt: Date; status: string;
  acceptedAnswerId: string | null; authorId: string; author: AuthorRow; _count: { answers: number };
};

export function legacyQuestionToFeedItem(q: LegacyQuestionRow, viewerId: string | null): FeedItem {
  return {
    key: feedKey("question", q.id), source: "question", kind: "question", id: q.id,
    title: q.title, content: q.content, category: "hoi-dap", imageUrls: [], fileUrl: null, fileName: null,
    createdAt: q.createdAt.toISOString(), isPinned: false, course: null,
    author: toFeedAuthor(q.author),
    likeCount: 0, replyCount: q._count.answers, likedByMe: false, bookmarkedByMe: false,
    isOwn: !!viewerId && q.authorId === viewerId,
    answered: !!q.acceptedAnswerId || q.status === "answered",
    href: `/cong-dong/hoi-dap/${q.id}`,
  };
}

// ─── Cây trả lời đúng 1 cấp ──────────────────────────────────────────────────

export type FlatReply = {
  id: string; parentReplyId: string | null; content: string; imageUrls: string[]; createdAt: Date | string;
  author: FeedAuthor; likeCount: number; likedByMe: boolean; isOwn: boolean; isAccepted: boolean; deleted: boolean;
};

const DELETED_AUTHOR: FeedAuthor = { id: null, label: "", tag: null, href: null };
const ts = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();

export function buildReplyTree(rows: FlatReply[]): ReplyNode[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  const rootOf = (r: FlatReply): string => {
    let cur = r; const seen = new Set<string>();
    while (cur.parentReplyId && byId.has(cur.parentReplyId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentReplyId)!;
    }
    return cur.id; // mồ côi (cha không còn) hoặc vòng → coi là gốc
  };
  const toNode = (r: FlatReply): ReplyNode => r.deleted
    ? { id: r.id, content: "", imageUrls: [], createdAt: new Date(ts(r.createdAt)).toISOString(), author: DELETED_AUTHOR,
        likeCount: 0, likedByMe: false, isOwn: false, isAccepted: false, deleted: true, children: [] }
    : { id: r.id, content: r.content, imageUrls: r.imageUrls, createdAt: new Date(ts(r.createdAt)).toISOString(), author: r.author,
        likeCount: r.likeCount, likedByMe: r.likedByMe, isOwn: r.isOwn, isAccepted: r.isAccepted, deleted: false, children: [] };
  const order = (a: FlatReply, b: FlatReply) => ts(a.createdAt) - ts(b.createdAt) || (a.id < b.id ? -1 : 1);
  const sorted = [...rows].sort(order);
  const roots = new Map<string, ReplyNode>();
  const rootOrder: string[] = [];
  for (const r of sorted) {
    const rid = rootOf(r);
    if (rid === r.id) { roots.set(r.id, toNode(r)); rootOrder.push(r.id); }
  }
  for (const r of sorted) {
    const rid = rootOf(r);
    if (rid !== r.id) roots.get(rid)?.children.push(toNode(r));
  }
  // Gốc đã xoá mà không còn con sống → bỏ; con đã xoá (lá) → bỏ.
  const out: ReplyNode[] = [];
  for (const id of rootOrder) {
    const n = roots.get(id)!;
    n.children = n.children.filter(c => !c.deleted);
    if (n.deleted && n.children.length === 0) continue;
    out.push(n);
  }
  return out;
}

// ─── Trích đoạn ──────────────────────────────────────────────────────────────

export function excerptOf(text: string, maxLines = 4, maxChars = 240): string {
  const lines = (text ?? "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, maxLines).join("\n");
  const chars = Array.from(lines);
  return chars.length > maxChars ? chars.slice(0, maxChars).join("").trimEnd() + "…" : lines;
}
