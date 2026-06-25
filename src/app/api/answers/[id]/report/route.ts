import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// POST /api/answers/[id]/report — báo cáo câu trả lời sai/spam (admin sẽ duyệt)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { id: answerId } = await params;
  const { reason } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "Vui lòng nêu lý do báo cáo" }, { status: 400 });

  const answer = await prisma.answer.findUnique({ where: { id: answerId }, select: { id: true, authorId: true } });
  if (!answer) return NextResponse.json({ error: "Không tìm thấy câu trả lời" }, { status: 404 });
  if (answer.authorId === auth.userId) {
    return NextResponse.json({ error: "Không thể tự báo cáo câu trả lời của mình" }, { status: 400 });
  }

  const existing = await prisma.answerReport.findUnique({
    where: { answerId_reporterId: { answerId, reporterId: auth.userId } },
  });
  if (existing) return NextResponse.json({ error: "Bạn đã báo cáo câu trả lời này rồi" }, { status: 409 });

  await prisma.answerReport.create({
    data: { answerId, reporterId: auth.userId, reason: reason.trim() },
  });

  return NextResponse.json({ success: true });
}
