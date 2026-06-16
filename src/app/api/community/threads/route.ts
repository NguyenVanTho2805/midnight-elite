import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const ALLOWED_CATEGORIES = ["hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"] as const;
const DEFAULT_PAGE_SIZE  = 20;
const MAX_PAGE_SIZE      = 100;

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const category   = searchParams.get("category") ?? undefined;
  const cursor     = searchParams.get("cursor") ?? undefined;
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);
  const pageSize   = isNaN(limitParam) ? DEFAULT_PAGE_SIZE : Math.min(limitParam, MAX_PAGE_SIZE);

  const include = {
    author:    { select: { id: true, name: true, role: true, adminRole: true } },
    _count:    { select: { replies: true, likes: true } },
    likes:     { where: { userId: auth.userId }, select: { userId: true } },
    bookmarks: { where: { userId: auth.userId }, select: { userId: true } },
  } as const;

  const [pinned, regular] = await Promise.all([
    prisma.thread.findMany({
      where:   { isPinned: true, ...(category ? { category } : {}) },
      orderBy: { createdAt: "desc" },
      include,
    }),
    prisma.thread.findMany({
      where: {
        isPinned: false,
        ...(category ? { category } : {}),
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

  return NextResponse.json({ threads: combined.map(toDTO.bind(null, auth.userId)), nextCursor });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  try {
    const { content, category, imageUrls, fileUrl, fileName } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
    }
    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "Nội dung không được vượt quá 2000 ký tự" }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Danh mục không hợp lệ" }, { status: 400 });
    }
    if (imageUrls && (!Array.isArray(imageUrls) || imageUrls.length > 4)) {
      return NextResponse.json({ error: "Tối đa 4 ảnh mỗi bài" }, { status: 400 });
    }

    const thread = await prisma.thread.create({
      data: {
        content:   content.trim(),
        authorId:  auth.userId,
        category,
        imageUrls: imageUrls ?? [],
        fileUrl:   fileUrl ?? null,
        fileName:  fileName ?? null,
      },
      include: {
        author:    { select: { id: true, name: true, role: true, adminRole: true } },
        _count:    { select: { replies: true, likes: true } },
        likes:     { where: { userId: auth.userId }, select: { userId: true } },
        bookmarks: { where: { userId: auth.userId }, select: { userId: true } },
      },
    });

    return NextResponse.json(toDTO(auth.userId, thread), { status: 201 });
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
    likeCount:      t._count.likes,
    replyCount:     t._count.replies,
    likedByMe:      t.likes.some(l => l.userId === userId),
    bookmarkedByMe: t.bookmarks.some(b => b.userId === userId),
  };
}
