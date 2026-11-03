import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notifyLikeAggregate } from "@/lib/notify";
import { notificationText, threadLink } from "@/lib/communityRules";
import { communityError, isUniqueViolation, loadAccessibleThread, NO_STORE, withLock } from "@/lib/communityServer";

// POST /api/community/replies/[id]/like — bật/tắt thích một trả lời. Trả lời đã xoá, bài đã xoá/chờ duyệt, hoặc bài lớp mà người gọi
// không phải thành viên → cùng một 404.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: replyId } = await params;

  const notFound = () => communityError(404, "not_found", "Không tìm thấy trả lời");
  const reply = await prisma.threadReply.findUnique({ where: { id: replyId }, select: { id: true, authorId: true, threadId: true, deletedAt: true } });
  if (!reply || reply.deletedAt) return notFound();
  if (!(await loadAccessibleThread(auth, reply.threadId))) return notFound();

  let likedByMe = false;
  let likeCount = 0;
  try {
    ({ likedByMe, likeCount } = await withLock(`rlike:${auth.userId}:${replyId}`, async tx => {
      const existing = await tx.replyLike.findUnique({ where: { userId_replyId: { userId: auth.userId, replyId } } });
      if (existing) await tx.replyLike.deleteMany({ where: { userId: auth.userId, replyId } });
      else await tx.replyLike.create({ data: { userId: auth.userId, replyId } });
      return { likedByMe: !existing, likeCount: await tx.replyLike.count({ where: { replyId } }) };
    }));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    likedByMe = true;
    likeCount = await prisma.replyLike.count({ where: { replyId } });
  }

  if (likedByMe && reply.authorId !== auth.userId) {
    await notifyLikeAggregate(reply.authorId, {
      type: "reply_like", link: threadLink(reply.threadId, replyId), singularTitle: notificationText("reply_like").title,
      buildMessage: count => notificationText("reply_like", count).message,
    });
  }
  return NextResponse.json({ likedByMe, likeCount }, { headers: NO_STORE });
}
