import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notifyLikeAggregate } from "@/lib/notify";
import { notificationText, threadLink } from "@/lib/communityRules";
import { isUniqueViolation, loadAccessibleThread, notFoundThread, NO_STORE, withLock } from "@/lib/communityServer";

// POST /api/community/threads/[id]/like — bật/tắt thích. An toàn khi gọi song song: các lần bấm của CÙNG người trên CÙNG bài xếp hàng
// qua advisory lock, nên không bao giờ 500 và trạng thái cuối nhất quán.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: threadId } = await params;

  const t = await loadAccessibleThread(auth, threadId);
  if (!t) return notFoundThread();

  let likedByMe = false;
  let likeCount = 0;
  try {
    ({ likedByMe, likeCount } = await withLock(`tlike:${auth.userId}:${threadId}`, async tx => {
      const key = { userId_threadId: { userId: auth.userId, threadId } };
      const existing = await tx.threadLike.findUnique({ where: key });
      if (existing) await tx.threadLike.deleteMany({ where: { userId: auth.userId, threadId } });
      else await tx.threadLike.create({ data: { userId: auth.userId, threadId } });
      return { likedByMe: !existing, likeCount: await tx.threadLike.count({ where: { threadId } }) };
    }));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    likedByMe = true; // đã có hàng (yêu cầu khác thắng) → coi như đã thích
    likeCount = await prisma.threadLike.count({ where: { threadId } });
  }

  // Không báo khi tự thích, khi bỏ thích, hoặc khi tác giả là tài khoản khách hệ thống.
  if (likedByMe && t.authorId !== auth.userId && t.guestName === null) {
    await notifyLikeAggregate(t.authorId, {
      type: "thread_like", link: threadLink(threadId), singularTitle: notificationText("thread_like").title,
      buildMessage: count => notificationText("thread_like", count).message,
    });
  }
  return NextResponse.json({ likedByMe, likeCount }, { headers: NO_STORE });
}
