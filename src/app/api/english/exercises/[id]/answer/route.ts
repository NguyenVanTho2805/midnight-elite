// POST /api/english/exercises/[id]/answer — { answer } → chấm, lưu lượt làm, trả đáp án + giải thích.
// Câu ngữ pháp làm sai → thành thẻ "làm lại" trong hàng ôn (Sổ lỗi). Cập nhật tiến độ unit.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, logStudy } from "@/lib/english/server";
import { gradeAnswer } from "@/lib/english/grading";
import { newCardRow } from "@/lib/english/srs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  const b = await req.json().catch(() => null) as { answer?: string; seconds?: number } | null;
  if (typeof b?.answer !== "string") return bad("Cần câu trả lời");
  const ex = await prisma.engExercise.findFirst({
    where: { id, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, answers: true, explanation: true, unitId: true, textId: true, type: true },
  });
  if (!ex) return bad("Không tìm thấy câu hỏi", 404);

  const correct = gradeAnswer(ex.answers, b.answer);
  await prisma.engAttempt.create({ data: { userId, exerciseId: ex.id, answer: b.answer.slice(0, 500), correct } });

  if (!correct && ex.unitId) {
    const key = `x:${ex.id}`;
    await prisma.engCard.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, kind: "exercise", cardType: "redo", exerciseId: ex.id, ...newCardRow(new Date(Date.now() + 86400_000)) },
      update: { suspended: false },
    });
  }

  let unitScore: number | null = null;
  if (ex.unitId) {
    const exercises = await prisma.engExercise.findMany({ where: { unitId: ex.unitId, flagged: false, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true } });
    const attempts = await prisma.engAttempt.findMany({ where: { userId, exerciseId: { in: exercises.map(e => e.id) } }, orderBy: { createdAt: "desc" }, select: { exerciseId: true, correct: true } });
    const last = new Map<string, boolean>();
    for (const a of attempts) if (!last.has(a.exerciseId)) last.set(a.exerciseId, a.correct);
    unitScore = exercises.length ? Math.round(([...last.values()].filter(Boolean).length / exercises.length) * 100) : 0;
    const done = last.size >= exercises.length && unitScore >= 80;
    await prisma.engUnitProgress.upsert({
      where: { userId_unitId: { userId, unitId: ex.unitId } },
      create: { userId, unitId: ex.unitId, status: done ? "done" : "learning", bestScore: unitScore, lastScore: unitScore, attempts: 1 },
      update: { lastScore: unitScore, attempts: { increment: 1 }, lastStudiedAt: new Date(), ...(done ? { status: "done" } : {}) },
    });
    await prisma.engUnitProgress.updateMany({ where: { userId, unitId: ex.unitId, bestScore: { lt: unitScore } }, data: { bestScore: unitScore } });
  }

  await logStudy(userId, ex.unitId ? "lop-hoc" : "doc", { items: 1, correct: correct ? 1 : 0, total: 1, seconds: Math.min(Number(b.seconds) || 0, 600) });
  return NextResponse.json({ correct, answers: ex.answers, explanation: ex.explanation, unitScore });
}
