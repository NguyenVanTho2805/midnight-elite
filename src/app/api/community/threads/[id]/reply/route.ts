import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { addCoins } from "@/lib/wallet";
import { REPLY_REWARD, MAX_REPLY_REWARDS_PER_DAY } from "@/lib/wallet-constants";

const RATE_LIMIT_REPLIES = 20;
const RATE_LIMIT_WINDOW  = 60 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: threadId } = await params;
  const { content, imageUrls } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
  }
  if (content.trim().length > 1000) {
    return NextResponse.json({ error: "Trả lời không được vượt quá 1000 ký tự" }, { status: 400 });
  }
  if (imageUrls && (!Array.isArray(imageUrls) || imageUrls.length > 2)) {
    return NextResponse.json({ error: "Tối đa 2 ảnh mỗi trả lời" }, { status: 400 });
  }

  const windowStart   = new Date(Date.now() - RATE_LIMIT_WINDOW);
  const recentReplies = await prisma.threadReply.count({
    where: { authorId: auth.userId, createdAt: { gte: windowStart } },
  });
  if (recentReplies >= RATE_LIMIT_REPLIES) {
    return NextResponse.json(
      { error: "Bạn đã trả lời quá nhiều lần trong 1 giờ. Vui lòng chờ trước khi tiếp tục." },
      { status: 429 },
    );
  }

  const exists = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true, authorId: true } });
  if (!exists) return NextResponse.json({ error: "Không tìm thấy thread" }, { status: 404 });

  const reply = await prisma.threadReply.create({
    data: {
      content:   content.trim(),
      authorId:  auth.userId,
      threadId,
      imageUrls: imageUrls ?? [],
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
      _count: { select: { likes: true } },
      likes:  { where: { userId: auth.userId }, select: { userId: true } },
    },
  });

  if (exists.authorId !== auth.userId) {
    await notify(exists.authorId, {
      type:    "thread_reply",
      title:   "Có trả lời mới",
      message: `${reply.author.name} đã trả lời bài viết của bạn`,
      link:    `/cong-dong/${threadId}`,
    });
  }

  // Thưởng xu cho reply, tối đa MAX_REPLY_REWARDS_PER_DAY lần/ngày
  let coinsEarned = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await prisma.coinTransaction.count({
    where: { userId: auth.userId, reason: "reply_reward", createdAt: { gte: todayStart } },
  });
  if (todayCount < MAX_REPLY_REWARDS_PER_DAY) {
    await addCoins(auth.userId, REPLY_REWARD, "reply_reward", reply.id);
    coinsEarned = REPLY_REWARD;
  }

  return NextResponse.json({
    id:        reply.id,
    content:   reply.content,
    imageUrls: reply.imageUrls,
    createdAt: reply.createdAt.toISOString(),
    author: {
      id:        reply.author.id,
      name:      reply.author.name,
      isTeacher: reply.author.role === "admin",
    },
    likeCount:   reply._count.likes,
    likedByMe:   false,
    isOwn:       true,
    coinsEarned,
  }, { status: 201 });
}
