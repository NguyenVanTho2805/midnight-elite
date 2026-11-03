import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { addDailyCappedCoins } from "@/lib/wallet";
import { REPLY_REWARD, MAX_REPLY_REWARDS_PER_DAY, COIN_REASONS } from "@/lib/wallet-constants";
import { cleanText, normalizeParent, notificationText, threadLink } from "@/lib/communityRules";
import { toFeedAuthor } from "@/lib/communityFeed";
import { AUTHOR_SELECT, communityError, loadAccessibleThread, notFoundThread, NO_STORE, withLock } from "@/lib/communityServer";
import type { ReplyNode } from "@/lib/communityTypes";

const RATE_LIMIT_REPLIES = 20;
const RATE_LIMIT_WINDOW  = 60 * 60 * 1000;

// POST /api/community/threads/[id]/reply { content, imageUrls?, parentReplyId? } — trả lời lồng đúng 1 cấp (trả lời con của con gộp lên cha gốc).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { id: threadId } = await params;

  const t = await loadAccessibleThread(auth, threadId);
  if (!t) return notFoundThread();

  let body: Record<string, unknown> = {};
  try { const j = await req.json(); if (j && typeof j === "object") body = j as Record<string, unknown>; } catch { /* để báo thiếu nội dung */ }

  const content = cleanText(body.content, true);
  if (!content) return communityError(400, "content_empty", "Nội dung không được để trống");
  if (Array.from(content).length > 1000) return communityError(400, "content_too_long", "Trả lời không được vượt quá 1000 ký tự");
  const imageUrls = body.imageUrls;
  if (imageUrls !== undefined && imageUrls !== null && (!Array.isArray(imageUrls) || imageUrls.length > 2 || imageUrls.some(u => typeof u !== "string"))) {
    return communityError(400, "too_many_images", "Tối đa 2 ảnh mỗi trả lời");
  }

  let parentRootId: string | null = null;
  let parentAuthorId: string | null = null;
  let isChild = false;
  const parentId = body.parentReplyId;
  if (parentId !== undefined && parentId !== null) {
    const parent = typeof parentId === "string"
      ? await prisma.threadReply.findUnique({ where: { id: parentId }, select: { id: true, threadId: true, parentReplyId: true, deletedAt: true, authorId: true } })
      : null;
    const norm = normalizeParent(threadId, parent);
    if (!norm.ok || !parent) return communityError(400, "parent_invalid", "Không thể trả lời bình luận này");
    parentRootId = norm.rootId;
    parentAuthorId = parent.authorId;
    isChild = true;
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW);
  const reply = await withLock(`reply:${auth.userId}`, async tx => {
    const recent = await tx.threadReply.count({ where: { authorId: auth.userId, createdAt: { gte: windowStart } } });
    if (recent >= RATE_LIMIT_REPLIES) return null;
    return tx.threadReply.create({
      data: { content, authorId: auth.userId, threadId, imageUrls: (imageUrls as string[] | undefined | null) ?? [], parentReplyId: parentRootId },
      include: { author: { select: AUTHOR_SELECT } },
    });
  });
  if (!reply) return communityError(429, "rate_limited", "Bạn đã trả lời quá nhiều lần trong 1 giờ. Vui lòng chờ trước khi tiếp tục.");

  // Thông báo (không tên, không tiêu đề). Không báo chính mình, không báo tài khoản khách.
  if (t.authorId !== auth.userId && t.guestName === null) {
    const n = notificationText("thread_reply");
    await notify(t.authorId, { type: n.type, title: n.title, message: n.message, link: threadLink(threadId) });
  }
  if (isChild && parentAuthorId && parentAuthorId !== auth.userId && parentAuthorId !== t.authorId) {
    const n = notificationText("thread_reply_child");
    await notify(parentAuthorId, { type: n.type, title: n.title, message: n.message, link: threadLink(threadId, reply.id) });
  }

  // Thưởng xu như cũ (logic ví không đổi trong BU-05); UI không hiển thị.
  const awarded = await addDailyCappedCoins(auth.userId, REPLY_REWARD, COIN_REASONS.REPLY_REWARD, reply.id, MAX_REPLY_REWARDS_PER_DAY);

  const node: ReplyNode & { coinsEarned: number } = {
    id: reply.id, content: reply.content, imageUrls: reply.imageUrls, createdAt: reply.createdAt.toISOString(),
    author: toFeedAuthor(reply.author), likeCount: 0, likedByMe: false, isOwn: true, isAccepted: false, deleted: false, children: [],
    coinsEarned: awarded ? REPLY_REWARD : 0,
  };
  return NextResponse.json(node, { status: 201, headers: NO_STORE });
}
