import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { addCoins, ANSWER_REWARD } from "@/lib/wallet";
import { COIN_REASONS } from "@/lib/wallet-constants";
import { notify } from "@/lib/notify";

// POST /api/answers/[id]/accept — chủ câu hỏi chấp nhận 1 câu trả lời, thưởng xu cho người trả lời
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: answerId } = await params;

  const answer = await prisma.answer.findUnique({
    where:   { id: answerId },
    include: { question: { select: { id: true, authorId: true, status: true, title: true } } },
  });
  if (!answer) return NextResponse.json({ error: "Không tìm thấy câu trả lời" }, { status: 404 });

  if (answer.question.authorId !== auth.userId) {
    return NextResponse.json({ error: "Chỉ chủ câu hỏi mới được chấp nhận câu trả lời" }, { status: 403 });
  }
  if (answer.question.status === "answered") {
    return NextResponse.json({ error: "Câu hỏi này đã có câu trả lời được chấp nhận" }, { status: 409 });
  }

  // Flip status atomically: updateMany với guard `status != "answered"` để 2
  // request accept đồng thời chỉ có 1 cái win (count=1). Cái thua count=0,
  // bail trước khi tiêu thụ addCoins → tránh thưởng kép ANSWER_REWARD.
  const flipped = await prisma.question.updateMany({
    where: { id: answer.question.id, status: { not: "answered" } },
    data:  { status: "answered", acceptedAnswerId: answer.id },
  });
  if (flipped.count === 0) {
    return NextResponse.json({ error: "Câu hỏi này đã có câu trả lời được chấp nhận" }, { status: 409 });
  }
  await prisma.answer.update({
    where: { id: answer.id },
    data:  { rewardPaid: ANSWER_REWARD },
  });

  await addCoins(answer.authorId, ANSWER_REWARD, COIN_REASONS.ANSWER_REWARD, answer.id);

  if (answer.authorId !== auth.userId) {
    await notify(answer.authorId, {
      type:    "answer_accepted",
      title:   "Câu trả lời được chấp nhận!",
      message: `Câu trả lời của bạn cho "${answer.question.title}" đã được chấp nhận, bạn nhận được ${ANSWER_REWARD} xu`,
      link:    `/student/hoi-dap/${answer.question.id}`,
    });
  }

  return NextResponse.json({ success: true });
}
