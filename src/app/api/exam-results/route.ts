import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadPublishState, loadPublishStates } from "@/lib/quizPublication";
import { resultVisibility } from "@/lib/quizRoom";
import { dropHeldResults, heldAttemptIdsAmong } from "@/lib/examHold";
import { rootIdOfExam } from "@/lib/examVariantServer";
import { maskName } from "@/lib/lookupPrivacy";
import { canSeeFullStudentNames } from "@/lib/examBoardPrivacy";
import { boardRowFor, selfScoreError } from "@/lib/examResultRules";
import { classExamViewBlock } from "@/lib/examResultAccessServer";
import { canWriteAttempt } from "@/lib/attemptAccess";

/** Hạng = 1 + số người có điểm cao hơn, chỉ đếm điểm đã công bố / đề không giữ điểm (examHold) và đã được gia sư duyệt (SCL-C, Q5: bỏ điểm tự khai chờ duyệt). */
async function rankOf(examId: string, score: number): Promise<number> {
  const all = await dropHeldResults(await prisma.examResult.findMany({ where: { examId, score: { gt: score }, pendingReview: false }, select: { userId: true, examId: true } }));
  return all.length + 1;
}

// GET /api/exam-results?examId=xxx — bảng xếp hạng 1 đề thi
// GET /api/exam-results?mine=true  — kết quả của user hiện tại (kèm rank)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const examIdParam = searchParams.get("examId");
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
        if (r.pendingReview) return { ...r, rank: null, pendingManual: false }; // SCL-C (Q5): điểm tự khai chờ gia sư duyệt — chưa có hạng
        return { ...r, rank: await rankOf(r.examId, r.score), pendingManual: false };
      })
    );

    // Lượt đã nộp mà đang bị giữ điểm thì CHƯA có dòng ExamResult (finalizeAttempt không ghi khi giữ): trả một dòng "chờ gia sư chấm" cho đề đó
    // để học sinh thấy bài đã được ghi nhận (không thấy như chưa làm), không có điểm, không có hạng.
    const haveResult = new Set(results.map(r => r.examId));
    const submitted = await prisma.examAttempt.findMany({
      where: { userId: session.userId, status: { not: "in_progress" } },
      orderBy: { submittedAt: "desc" },
      select: { id: true, examId: true, submittedAt: true, exam: { select: { title: true, code: true, totalPoints: true, variantOfId: true } } },
    });
    // BU-04: lượt ở MÃ CON tính cho ĐỀ GỐC (ExamResult ghi theo gốc); không trả id mã con ra ngoài.
    const submittedNoResult = submitted.filter(a => !haveResult.has(a.exam.variantOfId ?? a.examId));
    const held = await heldAttemptIdsAmong(submittedNoResult);
    const seen = new Set<string>();
    const pending = submittedNoResult.filter(a => { const root = a.exam.variantOfId ?? a.examId; return held.has(a.id) && !seen.has(root) && !!seen.add(root); }).map(a => ({
      id: `cho-${a.id}`, userId: session.userId, examId: a.exam.variantOfId ?? a.examId, score: null, totalPoints: a.exam.totalPoints,
      completedAt: a.submittedAt, exam: { title: a.exam.title, code: a.exam.code }, rank: null, pendingManual: true,
    }));

    return NextResponse.json([...withRank, ...pending]);
  }

  if (examIdParam) {
    // Yêu cầu đăng nhập để xem bảng điểm
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    // BU-04: ExamResult ghi theo ĐỀ GỐC (một dòng cho cả nhóm mã đề) — id mã con quy về gốc. Phần còn lại (top 50, hiển thị tên) KHÔNG đổi (quyết định COO 02/11).
    const examId = (await rootIdOfExam(examIdParam)) ?? examIdParam;

    // SCL-A (P2-7): đề gắn lớp — chỉ người trong lớp xem bảng điểm (lớp khác 403). Đề không tồn tại vẫn trả [] như cũ.
    const meta = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, ownerId: true, courseId: true, price: true, course: { select: { ownerId: true } } } });
    const viewBlock = meta ? await classExamViewBlock(session, meta) : null;
    if (viewBlock) return NextResponse.json(viewBlock, { status: 403 });

    // QZ-11: chưa được công bố thì không xem bảng điểm của đề có tự luận (điểm còn dở dang).
    if (!resultVisibility(await loadPublishState(examId, session.userId), true).showScore) return NextResponse.json([]);

    const results = await dropHeldResults(await prisma.examResult.findMany({
      where:   { examId, pendingReview: false }, // SCL-C (Q5): điểm tự khai chờ duyệt không lên bảng xếp hạng của đề
      include: { user: { select: { name: true } } },
      orderBy: { score: "desc" },
      take: 50,
    }));
    // NO-0511 (cùng họ quyết định 1B): tên thật chỉ cho quản trị / gia sư chủ đề / gia sư chủ lớp của đề; người khác thấy tên che (maskName), không trường, không email.
    // SCL-A: người thấy tên che cũng không nhận userId; dòng của chính mình có isMe.
    const full = canSeeFullStudentNames(session, { examOwnerId: meta?.ownerId ?? null, courseOwnerId: meta?.course?.ownerId ?? null });
    return NextResponse.json(results.map(r => boardRowFor(r, session.userId, full, maskName)));
  }

  return NextResponse.json([]);
}

// POST /api/exam-results — nộp kết quả thi
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { examId, score } = await req.json().catch(() => ({}));
  if (typeof examId !== "string" || !examId) return NextResponse.json({ error: "Thiếu đề thi" }, { status: 400 });

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, active: true, isDraft: true, totalPoints: true, courseId: true, price: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });

  // QZ-11: đề có câu hỏi trong KiN thì điểm chỉ đến từ lượt làm đã nộp (máy chủ chấm). Không cho tự nhập điểm — nếu không, học sinh
  // có thể ghi điểm tuỳ ý, bỏ qua giờ làm bài, số lượt và việc chờ chấm tự luận.
  if ((await prisma.examQuestion.count({ where: { examId } })) > 0) {
    return NextResponse.json({ error: "Đề này làm và chấm ngay trong KiN, không nhập điểm tay. Hãy vào làm bài." }, { status: 409 });
  }

  // SCL-A (P1-2): đề đang mở, không nháp; điểm 0..tổng điểm CỦA ĐỀ; đề gắn lớp thì phải đang học lớp đó (cùng luật ghi lượt làm bài).
  const bad = selfScoreError(exam, score);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (exam.courseId) {
    const [enrollment, guest] = await Promise.all([
      prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: exam.courseId } }, select: { status: true } }),
      prisma.examGuestAccess.findUnique({ where: { userId_examId: { userId: session.userId, examId } }, select: { userId: true } }),
    ]);
    if (!canWriteAttempt({ courseId: exam.courseId, price: exam.price, enrollment, hasGuestAccess: !!guest })) {
      return NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 });
    }
  }
  const points = Math.round(exam.totalPoints); // cột ExamResult.totalPoints là Int

  // Upsert + tăng participants (chỉ lần nộp đầu) trong cùng 1 transaction để tránh race condition
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.examResult.findUnique({
      where: { userId_examId: { userId: session.userId, examId } },
    });

    const r = await tx.examResult.upsert({
      where:  { userId_examId: { userId: session.userId, examId } },
      // Q5: điểm tự khai luôn ở trạng thái chờ gia sư duyệt (khai lại cũng phải duyệt lại); chưa duyệt thì không vào báo cáo tháng.
      create: { userId: session.userId, examId, score, totalPoints: points, pendingReview: true },
      update: { score, totalPoints: points, completedAt: new Date(), pendingReview: true },
    });

    if (!existing) {
      await tx.exam.update({
        where: { id: examId },
        data:  { participants: { increment: 1 } },
      });
    }

    return r;
  });

  // SCL-C (Q5): điểm vừa khai đang chờ gia sư duyệt ⇒ chưa có hạng (bảng xếp hạng chỉ tính điểm đã duyệt).
  return NextResponse.json({ ...result, rank: null });
}
