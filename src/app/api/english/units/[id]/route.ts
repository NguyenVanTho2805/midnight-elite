// GET /api/english/units/[id] — trang bài học: tóm tắt tiếng Việt, ý chính, ví dụ, lỗi hay gặp, bài tập (không kèm đáp án).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const u = await prisma.engUnit.findFirst({
    where: { id, ownerId: s.userId },
    select: {
      id: true, bookId: true, order: true, unitNo: true, title: true, group: true, pageStart: true, pageEnd: true, status: true, statusNote: true,
      summaryVi: true, keyPoints: true, examples: true, mistakesVi: true,
      book: { select: { title: true, kind: true } },
      exercises: { where: { flagged: false }, orderBy: [{ origin: "asc" }, { order: "asc" }], select: { id: true, type: true, instruction: true, prompt: true, options: true, origin: true, verified: true } },
    },
  });
  if (!u) return bad("Không tìm thấy bài", 404);
  const [prev, next, progress, attempts] = await Promise.all([
    prisma.engUnit.findFirst({ where: { bookId: u.bookId, order: { lt: u.order } }, orderBy: { order: "desc" }, select: { id: true, title: true, unitNo: true } }),
    prisma.engUnit.findFirst({ where: { bookId: u.bookId, order: { gt: u.order } }, orderBy: { order: "asc" }, select: { id: true, title: true, unitNo: true } }),
    prisma.engUnitProgress.findUnique({ where: { userId_unitId: { userId: s.userId, unitId: id } }, select: { status: true, bestScore: true, lastScore: true } }),
    prisma.engAttempt.findMany({ where: { userId: s.userId, exerciseId: { in: u.exercises.map(e => e.id) } }, orderBy: { createdAt: "desc" }, select: { exerciseId: true, correct: true } }),
  ]);
  const last: Record<string, boolean> = {};
  for (const a of attempts) if (!(a.exerciseId in last)) last[a.exerciseId] = a.correct;
  return NextResponse.json({ ...u, exercises: u.exercises.map(e => ({ ...e, lastCorrect: last[e.id] ?? null })), prev, next, progress });
}
