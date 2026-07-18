import { NextRequest, NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { spendCoins, InsufficientBalanceError, QUESTION_COST } from "@/lib/wallet";

// GET /api/questions — danh sách câu hỏi (mới nhất trước), đọc được cả khi
// chưa đăng nhập (giống GET /api/community/threads) vì tab "Hỏi đáp" hiển
// thị công khai cho guest trên trang /cong-dong.
export async function GET(req: NextRequest) {
  const session = await getSession();
  const userId  = session?.userId ?? "";

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "open" | "answered"

  const questions = await prisma.question.findMany({
    where:   status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take:    50,
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { answers: true } },
    },
  });

  return NextResponse.json(questions.map(q => ({
    id:           q.id,
    title:        q.title,
    content:      q.content,
    bountyPaid:   q.bountyPaid,
    status:       q.status,
    createdAt:    q.createdAt.toISOString(),
    author:       q.author,
    answerCount:  q._count.answers,
    isOwn:        q.authorId === userId,
  })));
}

// POST /api/questions — đăng câu hỏi mới, trừ QUESTION_COST xu
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;

  const { title, content } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 });
  }
  if (title.trim().length > 200) {
    return NextResponse.json({ error: "Tiêu đề không được vượt quá 200 ký tự" }, { status: 400 });
  }

  try {
    await spendCoins(auth.userId, QUESTION_COST, "question_cost");
  } catch (e) {
    if (e instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: `Bạn cần ít nhất ${QUESTION_COST} xu để đặt câu hỏi` }, { status: 402 });
    }
    throw e;
  }

  const question = await prisma.question.create({
    data: {
      title:      title.trim(),
      content:    content.trim(),
      authorId:   auth.userId,
      bountyPaid: QUESTION_COST,
    },
  });

  return NextResponse.json(question, { status: 201 });
}
