// POST /api/english/exercises/[id]/flag — báo câu sai/khó hiểu → ẩn câu đó. Chỉ với câu thuộc sách/bài CỦA TÔI
// (câu của bài công khai thì không cho một người ẩn với mọi người).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const ex = await prisma.engExercise.findFirst({ where: { id, ownerId: s.userId }, select: { id: true } });
  if (!ex) return bad("Chỉ ẩn được câu trong sách hoặc bài của bạn", 404);
  await prisma.engExercise.update({ where: { id }, data: { flagged: true } });
  await prisma.engCard.updateMany({ where: { userId: s.userId, exerciseId: id }, data: { suspended: true } });
  return NextResponse.json({ ok: true });
}
