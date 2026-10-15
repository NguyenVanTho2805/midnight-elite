// GET    /api/english/books/[id] — sách + danh sách unit + tiến độ của tôi.
// DELETE /api/english/books/[id] — xoá sách (kèm toàn bộ chữ, unit, bài tập, đoạn tìm kiếm).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const book = await prisma.engBook.findFirst({
    where: { id, ownerId: s.userId },
    select: {
      id: true, title: true, kind: true, fileName: true, pageCount: true, status: true, statusNote: true, unitsTotal: true, unitsDone: true,
      _count: { select: { pages: true } },
      units: { orderBy: { order: "asc" }, select: { id: true, order: true, unitNo: true, title: true, group: true, pageStart: true, pageEnd: true, status: true, _count: { select: { exercises: { where: { flagged: false } } } } } },
    },
  });
  if (!book) return bad("Không tìm thấy sách", 404);
  const progress = await prisma.engUnitProgress.findMany({ where: { userId: s.userId, unitId: { in: book.units.map(u => u.id) } }, select: { unitId: true, status: true, bestScore: true } });
  const pOf = new Map(progress.map(p => [p.unitId, p]));
  return NextResponse.json({
    ...book, pagesUploaded: book._count.pages,
    units: book.units.map(u => ({ ...u, exercises: u._count.exercises, progress: pOf.get(u.id) ?? null })),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const book = await prisma.engBook.findFirst({ where: { id, ownerId: s.userId }, select: { id: true } });
  if (!book) return bad("Không tìm thấy sách", 404);
  // thẻ "làm lại" của các câu trong sách bị xoá theo bài tập (onDelete Cascade)
  await prisma.engExercise.deleteMany({ where: { unit: { bookId: id } } });
  await prisma.engBook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
