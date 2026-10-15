// GET    /api/english/mock/[id] — chi tiết một bài thi thử (phiếu + đáp án + đúng/sai từng câu).
// DELETE /api/english/mock/[id] — xoá bài thi thử của tôi.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { gradeSheet } from "@/lib/english/mock";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const m = await prisma.engMock.findFirst({ where: { id, userId: s.userId } });
  if (!m) return bad("Không tìm thấy bài thi thử", 404);
  const items = m.answerKey.length ? gradeSheet(m.answerKey, m.answers).items : [];
  return NextResponse.json({ id: m.id, skill: m.skill, module: m.module, title: m.title, raw: m.raw, band: m.band, seconds: m.seconds, note: m.note, takenAt: m.takenAt, items });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const r = await prisma.engMock.deleteMany({ where: { id, userId: s.userId } });
  if (!r.count) return bad("Không tìm thấy bài thi thử", 404);
  return NextResponse.json({ ok: true });
}
