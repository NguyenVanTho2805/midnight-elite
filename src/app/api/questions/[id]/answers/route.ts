import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// POST /api/questions/[id]/answers — đăng câu trả lời (miễn phí, không trừ xu)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: questionId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
  if (content.trim().length > 3000) return NextResponse.json({ error: "Trả lời không được vượt quá 3000 ký tự" }, { status: 400 });

  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, authorId: true, title: true } });
  if (!question) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

  const answer = await prisma.answer.create({
    data: { content: content.trim(), authorId: auth.userId, questionId },
    include: { author: { select: { id: true, name: true } } },
  });

  if (question.authorId !== auth.userId) {
    await notify(question.authorId, {
      type:    "answer_new",
      title:   "Có câu trả lời mới",
      message: `${answer.author.name} đã trả lời câu hỏi "${question.title}" của bạn`,
      link:    `/student/hoi-dap/${questionId}`,
    });
  }

  return NextResponse.json({
    id:          answer.id,
    content:     answer.content,
    createdAt:   answer.createdAt.toISOString(),
    author:      answer.author,
    isAccepted:  false,
    isPenalized: false,
    isOwn:       true,
    reportedByMe: false,
  }, { status: 201 });
}
