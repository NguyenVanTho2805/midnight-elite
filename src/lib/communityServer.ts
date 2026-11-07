// BU-05 — phần máy chủ (có prisma) của cộng đồng. Luật thuần ở communityRules.ts / communityFeed.ts.
// Mọi truy vấn CÔNG KHAI đi qua `publishedThreadWhere`: bài xoá mềm / chờ duyệt / bị từ chối không bao giờ lọt ra.
import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/session";
import { activeHelperCourseIds, canAccessClass, canAccessThread, visibleThreadScope } from "@/lib/classThreadAccess";
import { PERMISSIONS, checkPermission } from "@/lib/permissions";
import {
  buildReplyTree, encodeCursor, excerptOf, feedKey, legacyQuestionToFeedItem, mergeFeedPages,
  sourceCursorWhere, threadToFeedItem, toFeedAuthor, type FeedCursor, type FlatReply,
} from "@/lib/communityFeed";
import { publicName } from "@/lib/communityRules";
import type {
  CommunityErrorCode, CommunityTab, FeedAuthor, FeedItem, FeedPage, GridItem, ProfileData, ReplyNode, SidebarData, ThreadDetail,
} from "@/lib/communityTypes";

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;
export const GUEST_EMAIL = "khach@he-thong.kin.invalid";

export function communityError(status: number, code: CommunityErrorCode, error: string) {
  return NextResponse.json({ error, code }, { status, headers: NO_STORE });
}
export const notFoundThread = () => communityError(404, "not_found", "Không tìm thấy bài viết");

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// Bài công khai: chưa xoá, đã duyệt.
export const publishedThreadWhere = { deletedAt: null, status: "published" } as const satisfies Prisma.ThreadWhereInput;

export function isCenterAdmin(s: SessionPayload | null): boolean {
  return s?.adminRole === "admin_super" || s?.adminRole === "admin_content";
}
export function canModerateCommunity(s: SessionPayload | null): boolean {
  return !!s && s.role === "admin" && checkPermission(s.adminRole, PERMISSIONS.MANAGE_COMMUNITY);
}

// ─── Giấu tên đồng giảng khỏi học viên (TUT-dong-giang Q5 = không) ────────────────

export const HELPER_AUTHOR: FeedAuthor = { id: null, label: "Giáo viên của lớp", tag: null, href: null };

/**
 * Tập khoá `${courseId}:${authorId}` của tác giả là đồng giảng / giáo viên bộ môn (đang hiệu lực HOẶC đã gỡ — bài cũ không được lộ tên) mà NGƯỜI XEM không được thấy tên:
 * người xem là học viên, khách, hay gia sư không thuộc lớp. Chủ lớp, đồng giảng của chính lớp đó và quản trị trung tâm thấy tên thật. Chủ lớp KHÔNG bị giấu (học viên biết GVCN).
 */
export async function helperAuthorsToHide(session: SessionPayload | null, pairs: { courseId: string | null; authorId: string | null }[]): Promise<Set<string>> {
  const rel = pairs.filter((p): p is { courseId: string; authorId: string } => !!p.courseId && !!p.authorId);
  if (rel.length === 0 || isCenterAdmin(session)) return new Set();
  const courseIds = [...new Set(rel.map(p => p.courseId))];
  const authorIds = [...new Set(rel.map(p => p.authorId))];
  const [rows, owned, helping] = await Promise.all([
    prisma.courseTeacher.findMany({
      where: { courseId: { in: courseIds }, userId: { in: authorIds }, status: { in: ["active", "removed"] } },
      select: { courseId: true, userId: true },
    }),
    session ? prisma.course.findMany({ where: { id: { in: courseIds }, ownerId: session.userId }, select: { id: true } }) : Promise.resolve([]),
    session && session.role === "admin" && session.adminRole === "teacher" ? activeHelperCourseIds(session.userId) : Promise.resolve([] as string[]),
  ]);
  const staff = new Set<string>([...owned.map(c => c.id), ...helping]);
  const hide = new Set<string>();
  for (const r of rows) if (!staff.has(r.courseId)) hide.add(`${r.courseId}:${r.userId}`);
  return hide;
}

export async function hideHelperNamesInItems<T extends { course: { id: string } | null; author: FeedAuthor }>(session: SessionPayload | null, items: T[]): Promise<T[]> {
  const hide = await helperAuthorsToHide(session, items.map(i => ({ courseId: i.course?.id ?? null, authorId: i.author.id })));
  if (hide.size === 0) return items;
  return items.map(i => (i.course && i.author.id && hide.has(`${i.course.id}:${i.author.id}`) ? { ...i, author: HELPER_AUTHOR } : i));
}

function hideInReplies(nodes: ReplyNode[], courseId: string, hide: Set<string>): ReplyNode[] {
  return nodes.map(n => ({
    ...n,
    author: n.author.id && hide.has(`${courseId}:${n.author.id}`) ? HELPER_AUTHOR : n.author,
    children: hideInReplies(n.children, courseId, hide),
  }));
}

// ─── Tham số ─────────────────────────────────────────────────────────────────

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export function parseLimit(raw: string | null): number | null {
  if (raw === null || raw === "") return DEFAULT_LIMIT;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_LIMIT ? n : null;
}

export function parseTab(raw: string | null): CommunityTab | null {
  if (raw === null || raw === "") return "all";
  if (raw === "hoi-dap-qa") return "hoi-dap";
  return (["all", "hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"] as const).find(t => t === raw) ?? null;
}

// ─── Khách ───────────────────────────────────────────────────────────────────

// HMAC của IP: chỉ để giới hạn tần suất, không đọc ngược được.
export function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET chưa được cấu hình");
  return createHmac("sha256", secret).update(`guest-ip:${ip}`).digest("hex");
}

// Tài khoản hệ thống đứng tên bài của khách (Thread.authorId bắt buộc). Bị khoá + mật khẩu ngẫu nhiên: không ai đăng nhập được.
export async function getOrCreateGuestAuthor(): Promise<string> {
  const found = await prisma.user.findUnique({ where: { email: GUEST_EMAIL }, select: { id: true } });
  if (found) return found.id;
  try {
    const password = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    const u = await prisma.user.create({
      data: { name: "Khách", email: GUEST_EMAIL, password, role: "student", banned: true },
      select: { id: true },
    });
    return u.id;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const again = await prisma.user.findUniqueOrThrow({ where: { email: GUEST_EMAIL }, select: { id: true } });
    return again.id;
  }
}

// ─── Chọn dữ liệu ────────────────────────────────────────────────────────────

export const AUTHOR_SELECT = { id: true, name: true, role: true, adminRole: true, tutorVerified: true, profileLockedAt: true } as const;
const NONE = "__none__";

function threadInclude(viewerId: string | null) {
  const uid = viewerId ?? NONE;
  return {
    author: { select: AUTHOR_SELECT },
    course: { select: { id: true, name: true } },
    _count: { select: { replies: { where: { deletedAt: null } }, likes: true } },
    likes: { where: { userId: uid }, select: { userId: true } },
    bookmarks: { where: { userId: uid }, select: { userId: true } },
  } as const;
}

const byNewest = [{ createdAt: "desc" }, { id: "desc" }] as const;

// ─── Feed hợp nhất ───────────────────────────────────────────────────────────

export type FeedParams = {
  session: SessionPayload | null;
  tab: CommunityTab;
  scope: string;               // "all" | "common" | <courseId>
  cursor: FeedCursor | null;
  limit: number;
};

export async function loadFeedPage(p: FeedParams): Promise<FeedPage | { forbidden: true }> {
  const viewerId = p.session?.userId ?? null;
  let scopeWhere: Prisma.ThreadWhereInput;
  if (p.scope === "common") scopeWhere = { courseId: null };
  else if (p.scope === "all") scopeWhere = await visibleThreadScope(p.session);
  else {
    if (!(await canAccessClass(p.session, p.scope))) return { forbidden: true };
    scopeWhere = { courseId: p.scope };
  }
  const categoryWhere: Prisma.ThreadWhereInput = p.tab === "all" ? {} : { category: p.tab };
  const base: Prisma.ThreadWhereInput[] = [publishedThreadWhere, scopeWhere, categoryWhere];
  // 3A (quyết định của Thọ 04/11/2026): KHÁCH không thấy câu hỏi cũ (bảng Question) trong bảng tin — mở /cong-dong/hoi-dap/<id> luôn đưa khách sang đăng nhập (route cũ đòi phiên),
  // nên liệt kê chúng cho khách chỉ lộ tiêu đề mà không đọc được. Người đã đăng nhập thấy như cũ.
  const includeLegacy = viewerId !== null && (p.scope === "all" || p.scope === "common") && (p.tab === "all" || p.tab === "hoi-dap");

  const [threads, legacy, pinned] = await Promise.all([
    prisma.thread.findMany({
      where: { AND: [...base, { isPinned: false }, sourceCursorWhere(p.cursor, "thread") as Prisma.ThreadWhereInput] },
      orderBy: [...byNewest], take: p.limit + 1, include: threadInclude(viewerId),
    }),
    includeLegacy
      ? prisma.question.findMany({
          where: sourceCursorWhere(p.cursor, "question") as Prisma.QuestionWhereInput,
          orderBy: [...byNewest], take: p.limit + 1,
          include: { author: { select: AUTHOR_SELECT }, _count: { select: { answers: true } } },
        })
      : Promise.resolve([]),
    p.cursor
      ? Promise.resolve([])
      : prisma.thread.findMany({
          where: { AND: [...base, { isPinned: true }] },
          orderBy: [...byNewest], take: 5, include: threadInclude(viewerId),
        }),
  ]);

  const merged = mergeFeedPages<FeedItem>(
    [threads.map(t => threadToFeedItem(t, viewerId)), legacy.map(q => legacyQuestionToFeedItem(q, viewerId))],
    p.limit,
  );
  const [pinnedItems, items] = await Promise.all([
    hideHelperNamesInItems(p.session, pinned.map(t => threadToFeedItem(t, viewerId))),
    hideHelperNamesInItems(p.session, merged.items),
  ]);
  return { pinned: pinnedItems, items, nextCursor: merged.nextCursor };
}

// "Đã lưu": chỉ bài còn công khai và lớp mà người gọi CÒN là thành viên.
export async function loadBookmarksPage(session: SessionPayload, cursor: FeedCursor | null, limit: number) {
  const scopeWhere = await visibleThreadScope(session);
  const rows = await prisma.threadBookmark.findMany({
    where: {
      userId: session.userId,
      thread: { AND: [publishedThreadWhere, scopeWhere] },
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, threadId: { lt: cursor.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { threadId: "desc" }],
    take: limit + 1,
    include: { thread: { include: threadInclude(session.userId) } },
  });
  const page = rows.slice(0, limit);
  const items = await hideHelperNamesInItems(session, page.map(r => ({ ...threadToFeedItem(r.thread, session.userId), bookmarkedByMe: true })));
  const last = page[page.length - 1];
  // Con trỏ của "Đã lưu" xếp theo thời điểm LƯU; nguồn luôn "thread".
  const nextCursor = rows.length > limit && last
    ? encodeCursor({ createdAt: last.createdAt, source: "thread", id: last.threadId })
    : null;
  return { items, nextCursor };
}

// ─── Một bài + quyền thao tác ────────────────────────────────────────────────

export type AccessibleThread = {
  id: string; authorId: string; courseId: string | null; kind: string; acceptedReplyId: string | null; guestName: string | null;
};

// Bài còn công khai VÀ người gọi được phép thấy; ngược lại null (mọi lý do → cùng một 404).
export async function loadAccessibleThread(session: SessionPayload | null, threadId: string): Promise<AccessibleThread | null> {
  const t = await prisma.thread.findUnique({
    where: { id: threadId },
    select: { id: true, authorId: true, courseId: true, kind: true, acceptedReplyId: true, guestName: true, deletedAt: true, status: true },
  });
  if (!t || t.deletedAt || t.status !== "published") return null;
  if (!(await canAccessThread(session, t))) return null;
  return { id: t.id, authorId: t.authorId, courseId: t.courseId, kind: t.kind, acceptedReplyId: t.acceptedReplyId, guestName: t.guestName };
}

// Người được "Chọn là đúng": chủ câu hỏi, gia sư chủ lớp (bài lớp), hoặc MANAGE_COMMUNITY.
export async function canAcceptReply(session: SessionPayload | null, t: { authorId: string; courseId: string | null }): Promise<boolean> {
  if (!session) return false;
  if (t.authorId === session.userId) return true;
  if (canModerateCommunity(session)) return true;
  if (t.courseId) {
    const c = await prisma.course.findUnique({ where: { id: t.courseId }, select: { ownerId: true } });
    return c?.ownerId === session.userId;
  }
  return false;
}

export async function loadThreadDetail(session: SessionPayload | null, threadId: string): Promise<ThreadDetail | null> {
  const viewerId = session?.userId ?? null;
  const t = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      ...threadInclude(viewerId),
      replies: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          author: { select: AUTHOR_SELECT },
          _count: { select: { likes: true } },
          likes: { where: { userId: viewerId ?? NONE }, select: { userId: true } },
        },
      },
    },
  });
  if (!t || t.deletedAt || t.status !== "published" || !(await canAccessThread(session, t))) return null;
  const item = threadToFeedItem(t, viewerId);
  const flat: FlatReply[] = t.replies.map(r => ({
    id: r.id, parentReplyId: r.parentReplyId, content: r.content, imageUrls: r.imageUrls, createdAt: r.createdAt,
    author: toFeedAuthor(r.author), likeCount: r._count.likes, likedByMe: r.likes.length > 0,
    isOwn: !!viewerId && r.authorId === viewerId, isAccepted: r.id === t.acceptedReplyId, deleted: r.deletedAt !== null,
  }));
  const { key: _k, source: _s, href: _h, ...rest } = item;
  void _k; void _s; void _h;
  const hide = await helperAuthorsToHide(session, [
    { courseId: t.courseId, authorId: t.authorId },
    ...t.replies.map(r => ({ courseId: t.courseId, authorId: r.authorId })),
  ]);
  const tree = buildReplyTree(flat);
  return {
    ...rest,
    author: t.courseId && rest.author.id && hide.has(`${t.courseId}:${rest.author.id}`) ? HELPER_AUTHOR : rest.author,
    canAccept: t.kind === "question" && (await canAcceptReply(session, t)),
    acceptedReplyId: t.acceptedReplyId,
    replies: t.courseId && hide.size ? hideInReplies(tree, t.courseId, hide) : tree,
  };
}

// ─── Cột phải ────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

/** `includeLegacy` = người xem đã đăng nhập (3A: khách không thấy câu hỏi cũ, xem loadFeedPage). */
export async function loadSidebar(includeLegacy: boolean): Promise<SidebarData> {
  const since = new Date(Date.now() - 30 * DAY);
  const grouped = await prisma.threadReply.groupBy({
    by: ["authorId"],
    where: {
      deletedAt: null, createdAt: { gte: since },
      thread: { ...publishedThreadWhere, kind: "question", courseId: null },
      author: { tutorVerified: true, profileLockedAt: null, role: "admin", adminRole: "teacher" },
    },
    _count: { _all: true },
    orderBy: { _count: { authorId: "desc" } },
    take: 3,
  });
  const users = grouped.length
    ? await prisma.user.findMany({ where: { id: { in: grouped.map(g => g.authorId) } }, select: { id: true, name: true, role: true, adminRole: true, tutorVerified: true, subjects: true } })
    : [];
  const tutors = grouped.flatMap(g => {
    const u = users.find(x => x.id === g.authorId);
    return u ? [{ id: u.id, label: publicName(u), subjects: u.subjects.slice(0, 3), answers30d: g._count._all, href: `/cong-dong/ho-so/${u.id}` }] : [];
  });

  const [threadQs, legacyQs] = await Promise.all([
    prisma.thread.findMany({
      where: { ...publishedThreadWhere, kind: "question", courseId: null, acceptedReplyId: null, replies: { none: { deletedAt: null } } },
      orderBy: [...byNewest], take: 5, select: { id: true, title: true, content: true, createdAt: true },
    }),
    includeLegacy
      ? prisma.question.findMany({
          where: { acceptedAnswerId: null, answers: { none: {} } },
          orderBy: [...byNewest], take: 5, select: { id: true, title: true, createdAt: true },
        })
      : Promise.resolve([] as { id: string; title: string; createdAt: Date }[]),
  ]);
  const unanswered = [
    ...threadQs.map(q => ({ key: feedKey("thread", q.id), title: q.title ?? excerptOf(q.content, 1, 80), createdAt: q.createdAt, href: `/cong-dong/${q.id}` })),
    ...legacyQs.map(q => ({ key: feedKey("question", q.id), title: q.title, createdAt: q.createdAt, href: `/cong-dong/hoi-dap/${q.id}` })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
    .map(x => ({ ...x, createdAt: x.createdAt.toISOString() }));
  return { tutors, unanswered };
}

// ─── Hồ sơ công khai ─────────────────────────────────────────────────────────

export async function loadProfile(session: SessionPayload | null, id: string, cursor: FeedCursor | null, limit: number): Promise<ProfileData | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, adminRole: true, tutorVerified: true, profileLockedAt: true, subjects: true, bio: true },
  });
  if (!u || u.email === GUEST_EMAIL) return null;
  const isSelf = !!session && session.userId === u.id;
  const publicTutor = u.role === "admin" && u.adminRole === "teacher" && u.tutorVerified && !u.profileLockedAt;
  if (!publicTutor && !isSelf) return null;
  const where: Prisma.ThreadWhereInput = {
    AND: [publishedThreadWhere, { authorId: u.id, courseId: null }, sourceCursorWhere(cursor, "thread") as Prisma.ThreadWhereInput],
  };
  const [rows, postCount, answerCount, legacyAnswers] = await Promise.all([
    prisma.thread.findMany({ where, orderBy: [...byNewest], take: limit + 1, select: { id: true, content: true, imageUrls: true, createdAt: true } }),
    prisma.thread.count({ where: { AND: [publishedThreadWhere, { authorId: u.id, courseId: null }] } }),
    prisma.threadReply.count({ where: { authorId: u.id, deletedAt: null, thread: { ...publishedThreadWhere, courseId: null } } }),
    prisma.answer.count({ where: { authorId: u.id } }),
  ]);
  const page = rows.slice(0, limit);
  const items: GridItem[] = page.map(r => ({ id: r.id, imageUrl: r.imageUrls[0] ?? null, excerpt: excerptOf(r.content), href: `/cong-dong/${r.id}` }));
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last
    ? encodeCursor({ createdAt: last.createdAt, source: "thread", id: last.id })
    : null;
  const tagSrc = { name: u.name, role: u.role, adminRole: u.adminRole, tutorVerified: u.tutorVerified };
  const author = toFeedAuthor({ ...tagSrc, id: u.id, profileLockedAt: u.profileLockedAt });
  return {
    profile: {
      id: u.id, label: publicName(tagSrc), tag: author.tag, subjects: u.subjects, bio: (u.bio ?? "").slice(0, 300),
      postCount, answerCount: answerCount + legacyAnswers, isSelf,
    },
    items, nextCursor,
  };
}

// ─── Cho TUT-003: câu hỏi của lớp chưa có trả lời ────────────────────────────

export async function unansweredClassQuestions(courseIds: string[], take = 20) {
  if (courseIds.length === 0) return [];
  return prisma.thread.findMany({
    where: { ...publishedThreadWhere, kind: "question", courseId: { in: courseIds }, acceptedReplyId: null, replies: { none: { deletedAt: null } } },
    orderBy: [...byNewest], take,
    select: { id: true, courseId: true, title: true, createdAt: true }, // không có tên người
  });
}

// ─── Khoá tuần tự ────────────────────────────────────────────────────────────

// Chạy `fn` trong giao dịch giữ advisory lock theo `key`: các yêu cầu cùng khoá xếp hàng, đếm-rồi-ghi không bị tranh chấp.
export async function withLock<T>(key: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    return fn(tx);
  });
}
