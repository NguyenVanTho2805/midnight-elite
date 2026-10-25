// QZ-03 — sửa / xoá một câu của quiz. Chỉ khi quiz chưa có lượt làm (đã có → 409 HAS_ATTEMPTS, đi đường "phiên bản mới").
// Câu phải thuộc ĐÚNG quiz trong đường dẫn (API cũ không kiểm điều này).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { coerceQuestionInput, validateQuizQuestion } from "@/lib/quizQuestion";
import { blockIfHasAttempts, loadOwnedQuiz, logChange, questionUpdateData, shapeQuestionForTutor, supersededBlock, syncQuizTotals, loadQuestions } from "@/lib/quizServer";

type P = { params: Promise<{ id: string; qid: string }> };

async function guard(tutorId: string, id: string, qid: string) {
  const got = await loadOwnedQuiz(tutorId, id);
  if (isNextResponse(got)) return got;
  const sup = supersededBlock(got.exam); if (sup) return sup;
  const blocked = blockIfHasAttempts(got.attemptCount); if (blocked) return blocked;
  const q = await prisma.examQuestion.findFirst({ where: { id: qid, examId: id }, select: { id: true } });
  if (!q) return NextResponse.json({ error: "Không tìm thấy câu này trong quiz." }, { status: 404 });
  return { got, q };
}

export async function PUT(req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id, qid } = await params;
    const g = await guard(auth.userId, id, qid);
    if (isNextResponse(g)) return g;
    const q = coerceQuestionInput(await req.json().catch(() => null));
    if ("error" in q) return NextResponse.json({ error: q.error }, { status: 400 });
    const err = validateQuizQuestion(q);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    await prisma.$transaction(async tx => {
      // Quiz chưa có lượt làm nên không có ExamAnswer nào trỏ vào lựa chọn cũ; xoá rồi dựng lại lựa chọn là an toàn ở đây.
      await tx.examOption.deleteMany({ where: { questionId: qid } });
      await tx.examQuestion.update({ where: { id: qid }, data: questionUpdateData(q) });
      await syncQuizTotals(tx, id);
      if (!g.got.exam.isDraft) await logChange(tx, { examId: id, rootExamId: g.got.exam.rootExamId, actorId: auth.userId, kind: "edit", note: "Sửa một câu (chưa có lượt làm)" });
    });
    const all = await loadQuestions(id);
    return NextResponse.json({ questions: all.map(shapeQuestionForTutor) });
  } catch (e) {
    console.error("[PUT /api/tutor/quiz/[id]/questions/[qid]]", e);
    return NextResponse.json({ error: "Chưa lưu được câu hỏi. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id, qid } = await params;
    const g = await guard(auth.userId, id, qid);
    if (isNextResponse(g)) return g;
    await prisma.$transaction(async tx => {
      await tx.examQuestion.delete({ where: { id: qid } });
      await syncQuizTotals(tx, id);
      if (!g.got.exam.isDraft) await logChange(tx, { examId: id, rootExamId: g.got.exam.rootExamId, actorId: auth.userId, kind: "edit", note: "Bỏ một câu (chưa có lượt làm)" });
    });
    const all = await loadQuestions(id);
    return NextResponse.json({ questions: all.map(shapeQuestionForTutor) });
  } catch (e) {
    console.error("[DELETE /api/tutor/quiz/[id]/questions/[qid]]", e);
    return NextResponse.json({ error: "Chưa xoá được câu. Thử lại sau ít phút." }, { status: 500 });
  }
}
