import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addDailyCappedCoins } from "@/lib/wallet";
import { THREAD_REWARD, MAX_THREAD_REWARDS_PER_DAY, COIN_REASONS } from "@/lib/wallet-constants";
import { canAccessClass, visibleThreadScope } from "@/lib/classThreadAccess";

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
    author:    { select: { id: true, name: true, role: true, adminRole: true } },
    course:    { select: { id: true, name: true } },
    _count:    { select: { replies: { where: { deletedAt: null } }, likes: true } },
    likes:     { where: { userId }, select: { userId: true } },
    bookmarks: { where: { userId }, select: { userId: true } },
  } as const;

  const [pinned, regular] = await Promise.all([
    prisma.thread.findMany({
      where:   { isPinned: true, deletedAt: null, ...(category ? { category } : {}), ...scope },
      orderBy: { createdAt: "desc" },
      include,
    }),
    prisma.thread.findMany({
      where: {
        isPinned: false,
        deletedAt: null,
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

  return NextResponse.json({ threads: combined.map(toDTO.bind(null, userId)), nextCursor });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  try {
    const { content, category, imageUrls, fileUrl, fileName, courseId } = await req.json() as {
      content?: string; category?: string;
      imageUrls?: unknown; fileUrl?: string | null; fileName?: string | null;
      courseId?: string | null;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
    }
    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "Nội dung không được vượt quá 2000 ký tự" }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Danh mục không hợp lệ" }, { status: 400 });
    }
    if (imageUrls && (!Array.isArray(imageUrls) || imageUrls.length > 4)) {
      return NextResponse.json({ error: "Tối đa 4 ảnh mỗi bài" }, { status: 400 });
    }

    // BE-071: validate courseId. Null hoặc không truyền = cộng đồng chung
    // (giữ hành vi cũ, ai login đều post được). Có courseId = chỉ members
    // của lớp đó (học viên Enrollment.active hoặc GVCN Course.ownerId) được
    // post. Admin cấp trên (admin_super/admin_content) được post vào bất kỳ
    // lớp nào — đồng bộ ownsResource mặc định "non-teacher adminRole bypass".
    if (courseId !== undefined && courseId !== null && typeof courseId !== "string") {
      return NextResponse.json({ error: "courseId không hợp lệ" }, { status: 400 });
    }
    if (courseId) {
      if (!(await canAccessClass(auth, courseId))) {
        return NextResponse.json(
          { error: "Bạn phải là học viên của lớp hoặc giáo viên chủ chốt mới được đăng bài" },
          { status: 403 },
        );
      }
    }

    const windowStart  = new Date(Date.now() - RATE_LIMIT_WINDOW);
    const recentPosts  = await prisma.thread.count({
      where: { authorId: auth.userId, createdAt: { gte: windowStart } },
    });
    if (recentPosts >= RATE_LIMIT_THREADS) {
      return NextResponse.json(
        { error: "Bạn đã đăng quá nhiều bài trong 1 giờ. Vui lòng chờ trước khi đăng tiếp." },
        { status: 429 },
      );
    }

    const thread = await prisma.thread.create({
      data: {
        content:   content.trim(),
        authorId:  auth.userId,
        category:  category as string,
        imageUrls: (imageUrls as string[] | undefined) ?? [],
        fileUrl:   fileUrl ?? null,
        fileName:  fileName ?? null,
        courseId:  courseId ?? null,
      },
      include: {
        author:    { select: { id: true, name: true, role: true, adminRole: true } },
        course:    { select: { id: true, name: true } },
        _count:    { select: { replies: { where: { deletedAt: null } }, likes: true } },
        likes:     { where: { userId: auth.userId }, select: { userId: true } },
        bookmarks: { where: { userId: auth.userId }, select: { userId: true } },
      },
    });

    // Thưởng xu cho bài viết, tối đa MAX_THREAD_REWARDS_PER_DAY lần/ngày.
    // addDailyCappedCoins serializable qua advisory_xact_lock → 2 request POST
    // đồng thời không cùng vượt cap.
    const awarded = await addDailyCappedCoins(
      auth.userId, THREAD_REWARD, COIN_REASONS.THREAD_REWARD, thread.id, MAX_THREAD_REWARDS_PER_DAY,
    );
    const coinsEarned = awarded ? THREAD_REWARD : 0;

    return NextResponse.json({ ...toDTO(auth.userId, thread), coinsEarned }, { status: 201 });
  } catch (e) {
    console.error("[community/POST]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

function toDTO(userId: string, t: {
  id: string; content: string; category: string; isPinned: boolean;
  imageUrls: string[]; fileUrl: string | null; fileName: string | null;
  createdAt: Date; updatedAt: Date;
  author:    { id: string; name: string; role: string; adminRole: string | null };
  course:    { id: string; name: string } | null;
  _count:    { replies: number; likes: number };
  likes:     { userId: string }[];
  bookmarks: { userId: string }[];
}) {
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
      name:      t.author.name,
      isTeacher: t.author.role === "admin",
    },
    course:         t.course,
    likeCount:      t._count.likes,
    replyCount:     t._count.replies,
    likedByMe:      t.likes.some(l => l.userId === userId),
    bookmarkedByMe: t.bookmarks.some(b => b.userId === userId),
  };
}
