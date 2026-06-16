import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: threadId } = await params;

  const exists = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  const existing = await prisma.threadBookmark.findUnique({
    where: { userId_threadId: { userId: auth.userId, threadId } },
  });

  if (existing) {
    await prisma.threadBookmark.delete({ where: { userId_threadId: { userId: auth.userId, threadId } } });
  } else {
    await prisma.threadBookmark.create({ data: { userId: auth.userId, threadId } });
  }

  return NextResponse.json({ bookmarkedByMe: !existing });
}
