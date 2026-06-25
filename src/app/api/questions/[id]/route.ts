import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET /api/questions/[id] — chi tiết câu hỏi + tất cả câu trả lời
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const question = await prisma.question.findUnique({
    where:   { id },
    include: {
      author:  { select: { id: true, name: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          author:  { select: { id: true, name: true } },
          reports: { where: { reporterId: auth.userId }, select: { id: true } },
        },
      },
    },
  });

  if (!question) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 });

  return NextResponse.json({
    id:               question.id,
    title:            question.title,
    content:          question.content,
    bountyPaid:       question.bountyPaid,
    status:           question.status,
    createdAt:        question.createdAt.toISOString(),
    author:           question.author,
    isOwn:            question.authorId === auth.userId,
    acceptedAnswerId: question.acceptedAnswerId,
    answers: question.answers.map(a => ({
      id:            a.id,
      content:       a.content,
      isAccepted:    a.id === question.acceptedAnswerId,
      isPenalized:   a.isPenalized,
      createdAt:     a.createdAt.toISOString(),
      author:        a.author,
      isOwn:         a.authorId === auth.userId,
      reportedByMe:  a.reports.length > 0,
    })),
  });
}
