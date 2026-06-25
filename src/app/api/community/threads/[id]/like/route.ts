import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: threadId } = await params;

  const exists = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true, authorId: true } });
  if (!exists) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  const existing = await prisma.threadLike.findUnique({
    where: { userId_threadId: { userId: auth.userId, threadId } },
  });

  if (existing) {
    await prisma.threadLike.delete({ where: { userId_threadId: { userId: auth.userId, threadId } } });
  } else {
    await prisma.threadLike.create({ data: { userId: auth.userId, threadId } });
    if (exists.authorId !== auth.userId) {
      const liker = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      await notify(exists.authorId, {
        type:    "thread_like",
        title:   "Có lượt thích mới",
        message: `${liker?.name ?? "Một học viên"} đã thích bài viết của bạn`,
        link:    `/student/cong-dong/${threadId}`,
      });
    }
  }

  const likeCount = await prisma.threadLike.count({ where: { threadId } });
  return NextResponse.json({ likedByMe: !existing, likeCount });
}
