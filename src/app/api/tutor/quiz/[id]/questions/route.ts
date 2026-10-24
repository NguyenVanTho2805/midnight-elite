// QZ-03 / QZ-04 — thêm một câu vào quiz của gia sư. Luật kiểm ở MÁY CHỦ (validateQuizQuestion); trình soạn chỉ báo sớm.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { coerceQuestionInput, validateQuizQuestion } from "@/lib/quizQuestion";
import { appendQuestions, blockIfHasAttempts, loadOwnedQuiz, logChange, shapeQuestionForTutor, supersededBlock, syncQuizTotals, loadQuestions } from "@/lib/quizServer";

const MAX_QUESTIONS_PER_QUIZ = 200;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const blocked = blockIfHasAttempts(got.attemptCount); if (blocked) return blocked;

    const q = coerceQuestionInput(await req.json().catch(() => null));
    if ("error" in q) return NextResponse.json({ error: q.error }, { status: 400 });
    const err = validateQuizQuestion(q);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    if (got.exam.questions >= MAX_QUESTIONS_PER_QUIZ) return NextResponse.json({ error: `Một quiz tối đa ${MAX_QUESTIONS_PER_QUIZ} câu.` }, { status: 400 });

    await prisma.$transaction(async tx => {
      await appendQuestions(tx, id, [q]);
      await syncQuizTotals(tx, id);
      if (!got.exam.isDraft) await logChange(tx, { examId: id, rootExamId: got.exam.rootExamId, actorId: auth.userId, kind: "edit", note: "Thêm một câu (chưa có lượt làm)" });
    });
    const all = await loadQuestions(id);
    return NextResponse.json({ questions: all.map(shapeQuestionForTutor) }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/quiz/[id]/questions]", e);
    return NextResponse.json({ error: "Chưa lưu được câu hỏi. Thử lại sau ít phút." }, { status: 500 });
  }
}
