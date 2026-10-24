// QZ-07 — "Tạo phiên bản mới": nhân bản quiz đang dùng thành một BẢN NHÁP (v2, v3…) để chỉnh mà không động tới bản cũ.
// Bản cũ giữ nguyên câu hỏi, đáp án, bài làm, điểm. Mỗi chuỗi chỉ có tối đa MỘT bản nháp chờ (gọi lại trả đúng bản nháp đó).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { cloneQuestionForVersion, nextVersionNo, pendingDraft, rootIdOf } from "@/lib/quizVersion";
import { appendQuestions, loadOwnedQuiz, logChange, supersededBlock, syncQuizTotals, toSnap } from "@/lib/quizServer";

const NOTE_MAX = 500;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const src = got.exam;
    if (src.isDraft) return NextResponse.json({ error: "Đây đang là bản nháp, cô sửa thẳng được — không cần tạo phiên bản mới." }, { status: 409 });

    const body = await req.json().catch(() => ({})) as { note?: unknown };
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > NOTE_MAX) return NextResponse.json({ error: `Lý do tối đa ${NOTE_MAX} ký tự.` }, { status: 400 });

    const rootId = rootIdOf(src);
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quiz-version:${rootId}`}))`;
      const chain = await tx.exam.findMany({
        where: { OR: [{ id: rootId }, { rootExamId: rootId }] },
        select: { id: true, code: true, rootExamId: true, versionNo: true, supersededById: true, isDraft: true },
      });
      const waiting = pendingDraft(chain);
      if (waiting) return { id: waiting.id, existed: true };

      const versionNo = nextVersionNo(chain);
      const rootCode = chain.find(c => c.id === rootId)?.code ?? src.code;
      const newId = `quiz-${crypto.randomUUID()}`;
      await tx.exam.create({
        data: {
          id: newId, code: `${rootCode}-v${versionNo}`, title: src.title, category: src.category, date: src.date, time: src.time, duration: src.duration,
          questions: 0, status: "upcoming", participants: 0, active: false, activeGuest: src.activeGuest, guestCanTake: src.guestCanTake,
          createdAt: new Date().toLocaleDateString("vi-VN"), ownerId: src.ownerId, courseId: src.courseId, price: src.price,
          clusterScorePercents: src.clusterScorePercents ?? undefined, totalPoints: src.totalPoints, showLeaderboard: src.showLeaderboard,
          answerVisibility: src.answerVisibility, hideAnswerForWrong: src.hideAnswerForWrong,
          password: src.password, passwordHash: src.passwordHash, azotaUrl: src.azotaUrl,
          isDraft: true, rootExamId: rootId, versionNo, versionNote: note || null,
        },
      });
      const qs = await tx.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
      await appendQuestions(tx, newId, qs.map(q => cloneQuestionForVersion(toSnap(q))));
      await syncQuizTotals(tx, newId);
      await logChange(tx, { examId: newId, rootExamId: rootId, actorId: auth.userId, kind: "new_version", note: `Soạn đề xuất v${versionNo} từ v${src.versionNo}${note ? ` · ${note}` : ""}` });
      return { id: newId, existed: false };
    });
    return NextResponse.json(result, { status: result.existed ? 200 : 201 });
  } catch (e) {
    console.error("[POST /api/tutor/quiz/[id]/new-version]", e);
    return NextResponse.json({ error: "Chưa tạo được phiên bản mới. Thử lại sau ít phút." }, { status: 500 });
  }
}
