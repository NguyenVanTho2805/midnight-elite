import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// POST /api/community/threads/[id]/report — báo cáo bài viết vi phạm (admin sẽ duyệt)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: threadId } = await params;
  const { reason } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "Vui lòng nêu lý do báo cáo" }, { status: 400 });

  const thread = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true, authorId: true, deletedAt: true } });
  if (!thread || thread.deletedAt) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
  if (thread.authorId === auth.userId) {
    return NextResponse.json({ error: "Không thể tự báo cáo bài viết của mình" }, { status: 400 });
  }

  const existing = await prisma.threadReport.findUnique({
    where: { threadId_reporterId: { threadId, reporterId: auth.userId } },
  });
  if (existing) return NextResponse.json({ error: "Bạn đã báo cáo bài viết này rồi" }, { status: 409 });

  await prisma.threadReport.create({
    data: { threadId, reporterId: auth.userId, reason: reason.trim() },
  });

  return NextResponse.json({ success: true });
}
