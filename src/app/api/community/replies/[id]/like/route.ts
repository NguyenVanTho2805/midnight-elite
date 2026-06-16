import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: replyId } = await params;

  const exists = await prisma.threadReply.findUnique({ where: { id: replyId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Không tìm thấy trả lời" }, { status: 404 });

  const existing = await prisma.replyLike.findUnique({
    where: { userId_replyId: { userId: auth.userId, replyId } },
  });

  if (existing) {
    await prisma.replyLike.delete({ where: { userId_replyId: { userId: auth.userId, replyId } } });
  } else {
    await prisma.replyLike.create({ data: { userId: auth.userId, replyId } });
  }

  const likeCount = await prisma.replyLike.count({ where: { replyId } });
  return NextResponse.json({ likedByMe: !existing, likeCount });
}
