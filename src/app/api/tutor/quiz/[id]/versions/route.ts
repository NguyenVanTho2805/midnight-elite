// QZ-07 — các phiên bản của một quiz: bản đang dùng, bản nháp chờ, so sánh hai bản, nhật ký thay đổi. Chỉ đọc, chỉ gia sư chủ quiz.
// Lượt làm đếm theo TỪNG phiên bản (ExamAttempt.examId) — bài làm cũ vẫn thuộc phiên bản cũ.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { currentPublished, diffQuestionSets, diffSummary, pendingDraft, rootIdOf } from "@/lib/quizVersion";
import { loadChain, loadOwnedQuiz, loadQuestions, toSnap } from "@/lib/quizServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const rootId = rootIdOf(got.exam);
    const chain = await loadChain(rootId);
    // Chuỗi chỉ có đề của chính gia sư này (phiên bản luôn tạo từ đề của mình), nhưng vẫn lọc để dữ liệu lạ không lọt ra.
    const owned = await prisma.exam.findMany({ where: { id: { in: chain.map(c => c.id) }, ownerId: auth.userId }, select: { id: true } });
    const ownedIds = new Set(owned.map(o => o.id));
    const mine = chain.filter(c => ownedIds.has(c.id));

    const [submitted, log, actor] = await Promise.all([
      prisma.examAttempt.groupBy({ by: ["examId"], where: { examId: { in: mine.map(c => c.id) }, status: { not: "in_progress" } }, _count: { _all: true } }),
      prisma.examChangeLog.findMany({ where: { OR: [{ examId: rootId }, { rootExamId: rootId }] }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
    ]);
    const nSub = new Map(submitted.map(g => [g.examId, g._count._all]));

    const live = currentPublished(mine), draft = pendingDraft(mine);
    let diff = null as null | { summary: string; data: ReturnType<typeof diffQuestionSets> };
    if (live && draft) {
      const [a, b] = await Promise.all([loadQuestions(live.id), loadQuestions(draft.id)]);
      const data = diffQuestionSets(a.map(toSnap), b.map(toSnap));
      diff = { summary: diffSummary(data), data };
    }
    return NextResponse.json({
      rootId, currentId: live?.id ?? null, draftId: draft?.id ?? null, thisId: id,
      chain: mine.map(c => ({
        id: c.id, versionNo: c.versionNo, status: c.isDraft ? "draft" : c.supersededById ? "superseded" : "current",
        attemptCount: c._count.attempts, submittedCount: nSub.get(c.id) ?? 0,
        date: c.date, time: c.time, duration: c.duration, questionCount: c.questions, versionNote: c.versionNote, supersededAt: c.supersededAt, title: c.title,
      })),
      diff,
      // Người thực hiện: mọi dòng nhật ký của quiz này là của chính gia sư chủ quiz (quiz không có người soạn thứ hai).
      log: log.map(l => ({ id: l.id, kind: l.kind, note: l.note, at: l.createdAt, actorName: l.actorId === auth.userId ? (actor?.name ?? "Cô") : "Người khác" })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/quiz/[id]/versions]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
