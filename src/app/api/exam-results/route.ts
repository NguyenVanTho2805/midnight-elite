import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadPublishState, loadPublishStates } from "@/lib/quizPublication";
import { resultVisibility } from "@/lib/quizRoom";
import { dropHeldResults, heldAttemptIdsAmong } from "@/lib/examHold";

/** Hạng = 1 + số người có điểm cao hơn, chỉ đếm điểm đã công bố / đề không giữ điểm (examHold). */
async function rankOf(examId: string, score: number): Promise<number> {
  const all = await dropHeldResults(await prisma.examResult.findMany({ where: { examId, score: { gt: score } }, select: { userId: true, examId: true } }));
  return all.length + 1;
}

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
        return { ...r, rank: await rankOf(r.examId, r.score), pendingManual: false };
      })
    );

    // Lượt đã nộp mà đang bị giữ điểm thì CHƯA có dòng ExamResult (finalizeAttempt không ghi khi giữ): trả một dòng "chờ gia sư chấm" cho đề đó
    // để học sinh thấy bài đã được ghi nhận (không thấy như chưa làm), không có điểm, không có hạng.
    const haveResult = new Set(results.map(r => r.examId));
    const submitted = await prisma.examAttempt.findMany({
      where: { userId: session.userId, status: { not: "in_progress" }, examId: { notIn: [...haveResult] } },
      orderBy: { submittedAt: "desc" },
      select: { id: true, examId: true, submittedAt: true, exam: { select: { title: true, code: true, totalPoints: true } } },
    });
    const held = await heldAttemptIdsAmong(submitted);
    const seen = new Set<string>();
    const pending = submitted.filter(a => held.has(a.id) && !seen.has(a.examId) && !!seen.add(a.examId)).map(a => ({
      id: `cho-${a.id}`, userId: session.userId, examId: a.examId, score: null, totalPoints: a.exam.totalPoints,
      completedAt: a.submittedAt, exam: { title: a.exam.title, code: a.exam.code }, rank: null, pendingManual: true,
    }));

    return NextResponse.json([...withRank, ...pending]);
  }

  if (examId) {
    // Yêu cầu đăng nhập để xem bảng điểm
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    // QZ-11: chưa được công bố thì không xem bảng điểm của đề có tự luận (điểm còn dở dang).
    if (!resultVisibility(await loadPublishState(examId, session.userId), true).showScore) return NextResponse.json([]);

    const results = await dropHeldResults(await prisma.examResult.findMany({
      where:   { examId },
      include: { user: { select: { name: true } } },
      orderBy: { score: "desc" },
      take: 50,
    }));
    return NextResponse.json(results);
  }

  return NextResponse.json([]);
}

// POST /api/exam-results — học sinh TỰ KHAI điểm cho đề làm bên ngoài (Azota).
// Đề có câu hỏi trong KiN được chấm ở server (finalizeAttempt → upsertBestResult);
// điểm tự khai không được ghi đè lên đó, nếu không ai cũng gửi 150 rồi lên đầu bảng xếp hạng.
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

  const exam = await prisma.exam.findUnique({
    where:  { id: examId },
    select: { id: true, _count: { select: { examQuestions: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (exam._count.examQuestions > 0) {
    return NextResponse.json(
      { error: "Đề này làm và chấm ngay trong KiN, không nhận điểm tự khai." },
      { status: 403 },
    );
  }

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
