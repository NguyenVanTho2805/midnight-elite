import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addDailyCappedCoins } from "@/lib/wallet";
import { THREAD_REWARD, MAX_THREAD_REWARDS_PER_DAY, COIN_REASONS } from "@/lib/wallet-constants";
import { canAccessClass, visibleThreadScope } from "@/lib/classThreadAccess";
import { notify } from "@/lib/notify";
import { cleanText, notificationText, publicName } from "@/lib/communityRules";
import { communityError, publishedThreadWhere, withLock, NO_STORE, AUTHOR_SELECT, isCenterAdmin, helperAuthorsToHide, HELPER_AUTHOR } from "@/lib/communityServer";
import { threadToFeedItem } from "@/lib/communityFeed";

const ALLOWED_CATEGORIES = ["hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"] as const;
const DEFAULT_PAGE_SIZE  = 20;
const MAX_PAGE_SIZE      = 100;
const RATE_LIMIT_THREADS = 5;   // max posts per hour
const RATE_LIMIT_WINDOW  = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const session = await getSession();
  const userId  = session?.userId ?? "";

  const { searchParams } = new URL(req.url);
  const category   = searchParams.get("category") ?? undefined;
  const cursor     = searchParams.get("cursor") ?? undefined;
  if (cursor && Number.isNaN(new Date(cursor).getTime())) {
    return communityError(400, "cursor_invalid", "Con trỏ không hợp lệ");
  }
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);
  const pageSize   = isNaN(limitParam) ? DEFAULT_PAGE_SIZE : Math.min(limitParam, MAX_PAGE_SIZE);

  // Lọc phạm vi (BE-070):
  //   - không truyền `courseId`     → cộng đồng chung + thread các lớp người
  //                                    gọi là member (khách: chỉ chung). Không
  //                                    trả thread lớp khác — bài cũ toàn là
  //                                    courseId=null nên hành vi cũ giữ nguyên.
  //   - `courseId=null` (literal)    → chỉ "cộng đồng chung"
  //   - `courseId=<id>`              → chỉ thread của lớp đó, phải là member
  const courseIdParam = searchParams.get("courseId");
  let scope: object;
  if (courseIdParam === "null") {
    scope = { courseId: null };
  } else if (courseIdParam) {
    if (!(await canAccessClass(session, courseIdParam))) {
      return NextResponse.json({ error: "Không có quyền xem bài viết của lớp này" }, { status: 403 });
    }
    scope = { courseId: courseIdParam };
  } else {
    scope = await visibleThreadScope(session);
  }

  const include = {
    author:    { select: AUTHOR_SELECT },
    course:    { select: { id: true, name: true } },
    _count:    { select: { replies: { where: { deletedAt: null } }, likes: true } },
    likes:     { where: { userId }, select: { userId: true } },
    bookmarks: { where: { userId }, select: { userId: true } },
  } as const;

  const [pinned, regular] = await Promise.all([
    prisma.thread.findMany({
      where:   { isPinned: true, ...publishedThreadWhere, ...(category ? { category } : {}), ...scope },
      orderBy: { createdAt: "desc" },
      include,
    }),
    prisma.thread.findMany({
      where: {
        isPinned: false,
        ...publishedThreadWhere,
        ...(category ? { category } : {}),
        ...scope,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    pageSize,
      include,
    }),
  ]);

  const pinnedIds  = new Set(pinned.map(t => t.id));
  const combined   = [...pinned, ...regular.filter(t => !pinnedIds.has(t.id))];
  const nextCursor = regular.length === pageSize
    ? regular[regular.length - 1].createdAt.toISOString()
    : null;

  // Tên: quản trị thấy tên đầy đủ (kiểm duyệt); người khác thấy tên rút gọn (học sinh) — TRẺ EM.
  const fullNames = isCenterAdmin(session);
  // Q5: học viên / khách không thấy tên đồng giảng của lớp.
  const hide = await helperAuthorsToHide(session, combined.map(t => ({ courseId: t.course?.id ?? null, authorId: t.author.id })));
  const threads = combined.map(t => {
    const dto = toDTO(userId, t, fullNames);
    return t.course && hide.has(`${t.course.id}:${t.author.id}`) ? { ...dto, author: { id: null, name: HELPER_AUTHOR.label, isTeacher: true } } : dto;
  });
  return NextResponse.json({ threads, nextCursor }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  try {
    let body: Record<string, unknown> = {};
    try { const j = await req.json(); if (j && typeof j === "object") body = j as Record<string, unknown>; } catch { /* thân rỗng → báo thiếu nội dung */ }

    const kindRaw = body.kind ?? "post";
    if (kindRaw !== "post" && kindRaw !== "question") return communityError(400, "kind_invalid", "Loại bài không hợp lệ");
    const kind = kindRaw;

    const content = cleanText(body.content, true);
    if (!content) return communityError(400, "content_empty", "Nội dung không được để trống");
    if (Array.from(content).length > 2000) return communityError(400, "content_too_long", "Nội dung không được vượt quá 2000 ký tự");

    let title: string | null = null;
    if (kind === "question") {
      title = cleanText(body.title);
      if (Array.from(title).length < 5) return communityError(400, "title_required", "Câu hỏi cần có tiêu đề (từ 5 ký tự)");
      if (Array.from(title).length > 120) return communityError(400, "title_too_long", "Tiêu đề không được vượt quá 120 ký tự");
    }

    const category = kind === "question" ? "hoi-dap" : body.category;
    if (!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])) {
      return communityError(400, "category_invalid", "Danh mục không hợp lệ");
    }
    const imageUrls = body.imageUrls;
    if (imageUrls !== undefined && imageUrls !== null && (!Array.isArray(imageUrls) || imageUrls.length > 4 || imageUrls.some(u => typeof u !== "string"))) {
      return communityError(400, "too_many_images", "Tối đa 4 ảnh mỗi bài");
    }
    const fileUrl  = typeof body.fileUrl === "string" ? body.fileUrl : null;
    const fileName = typeof body.fileName === "string" ? body.fileName : null;

    // BE-071: courseId null/không truyền = cộng đồng chung; có courseId = chỉ thành viên lớp (hoặc quản trị cấp trên) được đăng.
    const courseId = body.courseId;
    if (courseId !== undefined && courseId !== null && typeof courseId !== "string") {
      return communityError(400, "not_member", "courseId không hợp lệ");
    }
    if (courseId && !(await canAccessClass(auth, courseId))) {
      return communityError(403, "not_member", "Bạn phải là học viên của lớp hoặc giáo viên chủ chốt mới được đăng bài");
    }

    // Giới hạn 5 bài/giờ/người (chung post + question); đếm-rồi-ghi trong một khoá nên bấm đúp không lọt.
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW);
    const thread = await withLock(`thread:${auth.userId}`, async tx => {
      const recent = await tx.thread.count({ where: { authorId: auth.userId, createdAt: { gte: windowStart } } });
      if (recent >= RATE_LIMIT_THREADS) return null;
      return tx.thread.create({
        data: {
          content, authorId: auth.userId, category: category as string, kind, title,
          imageUrls: (imageUrls as string[] | undefined | null) ?? [], fileUrl, fileName, courseId: courseId ?? null,
        },
        include: {
          author:    { select: AUTHOR_SELECT },
          course:    { select: { id: true, name: true } },
          _count:    { select: { replies: { where: { deletedAt: null } }, likes: true } },
          likes:     { where: { userId: auth.userId }, select: { userId: true } },
          bookmarks: { where: { userId: auth.userId }, select: { userId: true } },
        },
      });
    });
    if (!thread) {
      return communityError(429, "rate_limited", "Bạn đã đăng quá nhiều bài trong 1 giờ. Vui lòng chờ trước khi đăng tiếp.");
    }

    // Bài vào lớp → báo chủ lớp (không tên, không tiêu đề); không báo chính người đăng.
    if (thread.courseId) {
      const course = await prisma.course.findUnique({ where: { id: thread.courseId }, select: { ownerId: true } });
      if (course?.ownerId && course.ownerId !== auth.userId) {
        const n = notificationText("thread_new_class");
        await notify(course.ownerId, { type: n.type, title: n.title, message: n.message, link: `/cong-dong/${thread.id}` });
      }
    }

    // Thưởng xu như cũ CHỈ cho bài viết thường (câu hỏi mới không thưởng/không trừ). UI không hiển thị.
    let coinsEarned = 0;
    if (kind === "post" && auth.role === "student") {   // Coin chỉ cho học sinh (gia sư / đồng giảng không nhận)
      const awarded = await addDailyCappedCoins(
        auth.userId, THREAD_REWARD, COIN_REASONS.THREAD_REWARD, thread.id, MAX_THREAD_REWARDS_PER_DAY,
      );
      coinsEarned = awarded ? THREAD_REWARD : 0;
    }

    return NextResponse.json({ ...threadToFeedItem(thread, auth.userId), coinsEarned }, { status: 201, headers: NO_STORE });
  } catch (e) {
    console.error("[community/POST]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

function toDTO(userId: string, t: {
  id: string; content: string; category: string; isPinned: boolean;
  imageUrls: string[]; fileUrl: string | null; fileName: string | null;
  createdAt: Date; updatedAt: Date;
  author:    { id: string; name: string; role: string; adminRole: string | null; tutorVerified: boolean };
  course:    { id: string; name: string } | null;
  _count:    { replies: number; likes: number };
  likes:     { userId: string }[];
  bookmarks: { userId: string }[];
}, fullNames: boolean) {
  return {
    id:           t.id,
    content:      t.content,
    category:     t.category,
    isPinned:     t.isPinned,
    imageUrls:    t.imageUrls,
    fileUrl:      t.fileUrl,
    fileName:     t.fileName,
    createdAt:    t.createdAt.toISOString(),
    author: {
      id:        t.author.id,
      name:      fullNames ? t.author.name : publicName(t.author),
      isTeacher: t.author.role === "admin",
    },
    course:         t.course,
    likeCount:      t._count.likes,
    replyCount:     t._count.replies,
    likedByMe:      t.likes.some(l => l.userId === userId),
    bookmarkedByMe: t.bookmarks.some(b => b.userId === userId),
  };
}
