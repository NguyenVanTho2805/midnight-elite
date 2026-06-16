import { NextRequest, NextResponse } from "next/server";
import { requireSession, requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      author:    { select: { id: true, name: true, role: true, adminRole: true } },
      _count:    { select: { replies: true, likes: true } },
      likes:     { where: { userId: auth.userId }, select: { userId: true } },
      bookmarks: { where: { userId: auth.userId }, select: { userId: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, role: true, adminRole: true } },
          _count: { select: { likes: true } },
          likes:  { where: { userId: auth.userId }, select: { userId: true } },
        },
      },
    },
  });

  if (!thread) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  return NextResponse.json({
    id:           thread.id,
    content:      thread.content,
    category:     thread.category,
    isPinned:     thread.isPinned,
    imageUrls:    thread.imageUrls,
    fileUrl:      thread.fileUrl,
    fileName:     thread.fileName,
    createdAt:    thread.createdAt.toISOString(),
    author: {
      id:        thread.author.id,
      name:      thread.author.name,
      isTeacher: thread.author.role === "admin",
    },
    likeCount:      thread._count.likes,
    replyCount:     thread._count.replies,
    likedByMe:      thread.likes.some(l => l.userId === auth.userId),
    bookmarkedByMe: thread.bookmarks.some(b => b.userId === auth.userId),
    replies: thread.replies.map(r => ({
      id:        r.id,
      content:   r.content,
      imageUrls: r.imageUrls,
      createdAt: r.createdAt.toISOString(),
      author: {
        id:        r.author.id,
        name:      r.author.name,
        isTeacher: r.author.role === "admin",
      },
      likeCount:  r._count.likes,
      likedByMe:  r.likes.some(l => l.userId === auth.userId),
      isOwn:      r.authorId === auth.userId,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const { isPinned } = await req.json();

  try {
    const updated = await prisma.thread.update({
      where:  { id },
      data:   { isPinned: Boolean(isPinned) },
      select: { id: true, isPinned: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const thread = await prisma.thread.findUnique({ where: { id }, select: { authorId: true } });
  if (!thread) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  const isAdmin = auth.role === "admin";
  const isOwner = thread.authorId === auth.userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Không có quyền xoá bài này" }, { status: 403 });
  }

  await prisma.thread.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
