// QZ-04 — đổi thứ tự câu. Danh sách id gửi lên phải là ĐÚNG tập câu hiện có của quiz (không thiếu, không thừa, không trùng).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { blockIfHasAttempts, loadOwnedQuiz, loadQuestions, shapeQuestionForTutor, supersededBlock } from "@/lib/quizServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedQuiz(auth.userId, id);
    if (isNextResponse(got)) return got;
    const sup = supersededBlock(got.exam); if (sup) return sup;
    const blocked = blockIfHasAttempts(got.attemptCount); if (blocked) return blocked;
    const body = await req.json().catch(() => ({})) as { ids?: unknown };
    const ids = Array.isArray(body.ids) && body.ids.every(x => typeof x === "string") ? body.ids as string[] : null;
    const current = await prisma.examQuestion.findMany({ where: { examId: id }, select: { id: true } });
    if (!ids || ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every(x => current.some(c => c.id === x))) {
      return NextResponse.json({ error: "Danh sách câu không khớp với quiz. Tải lại trang rồi thử lại." }, { status: 400 });
    }
    await prisma.$transaction(ids.map((qid, i) => prisma.examQuestion.update({ where: { id: qid }, data: { order: i + 1 } })));
    return NextResponse.json({ questions: (await loadQuestions(id)).map(shapeQuestionForTutor) });
  } catch (e) {
    console.error("[POST /api/tutor/quiz/[id]/questions/reorder]", e);
    return NextResponse.json({ error: "Chưa đổi được thứ tự. Thử lại sau ít phút." }, { status: 500 });
  }
}
