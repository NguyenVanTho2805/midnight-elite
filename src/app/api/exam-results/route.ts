import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadPublishState, loadPublishStates } from "@/lib/quizPublication";
import { resultVisibility } from "@/lib/quizRoom";

// GET /api/exam-results?examId=xxx — bảng xếp hạng 1 đề thi
// GET /api/exam-results?mine=true  — kết quả của user hiện tại (kèm rank)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("examId");
  const mine   = searchParams.get("mine") === "true";

  if (mine) {
    const session = await getSession();
    if (!session) return NextResponse.json([]);

    const results = await prisma.examResult.findMany({
      where:   { userId: session.userId },
      include: { exam: { select: { title: true, code: true } } },
      orderBy: { completedAt: "desc" },
    });

    // Tính rank song song — N queries chạy concurrent, không sequential
    // QZ-11: quiz có tự luận mà gia sư chưa công bố → điểm hiện có chỉ là phần trắc nghiệm; không trả điểm/hạng dở dang.
    const states = await loadPublishStates(results.map(r => r.examId), session.userId);
    const withRank = await Promise.all(
      results.map(async r => {
        const vis = resultVisibility(states.get(r.examId) ?? { hasEssay: false, published: true }, true);
        if (!vis.showScore) return { ...r, score: null, rank: null, pendingManual: true };
        const above = await prisma.examResult.count({
          where: { examId: r.examId, score: { gt: r.score } },
        });
        return { ...r, rank: above + 1, pendingManual: false };
      })
    );

    return NextResponse.json(withRank);
  }

  if (examId) {
    // Yêu cầu đăng nhập để xem bảng điểm
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    // QZ-11: chưa được công bố thì không xem bảng điểm của đề có tự luận (điểm còn dở dang).
    if (!resultVisibility(await loadPublishState(examId, session.userId), true).showScore) return NextResponse.json([]);

    const results = await prisma.examResult.findMany({
      where:   { examId },
      include: { user: { select: { name: true } } },
      orderBy: { score: "desc" },
      take: 50,
    });
    return NextResponse.json(results);
  }

  return NextResponse.json([]);
}

// POST /api/exam-results — nộp kết quả thi
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { examId, score } = await req.json();
  const points = 150; // Thang điểm chuẩn HSA — không nhận từ client để tránh injection

  if (
    !examId ||
    typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > points
  ) {
    return NextResponse.json({ error: "Thông tin điểm không hợp lệ (0–150)" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  // QZ-11: đề có câu hỏi trong KiN thì điểm chỉ đến từ lượt làm đã nộp (máy chủ chấm). Không cho tự nhập điểm — nếu không, học sinh
  // có thể ghi điểm tuỳ ý, bỏ qua giờ làm bài, số lượt và việc chờ chấm tự luận.
  if ((await prisma.examQuestion.count({ where: { examId } })) > 0) {
    return NextResponse.json({ error: "Đề này làm và chấm ngay trong KiN, không nhập điểm tay. Hãy vào làm bài." }, { status: 409 });
  }

  // Upsert + tăng participants (chỉ lần nộp đầu) trong cùng 1 transaction để tránh race condition
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.examResult.findUnique({
      where: { userId_examId: { userId: session.userId, examId } },
    });

    const r = await tx.examResult.upsert({
      where:  { userId_examId: { userId: session.userId, examId } },
      create: { userId: session.userId, examId, score, totalPoints: points },
      update: { score, completedAt: new Date() },
    });

    if (!existing) {
      await tx.exam.update({
        where: { id: examId },
        data:  { participants: { increment: 1 } },
      });
    }

    return r;
  });

  // Tính rank
  const above = await prisma.examResult.count({
    where: { examId, score: { gt: score } },
  });

  return NextResponse.json({ ...result, rank: above + 1 });
}
