// POST /api/english/units/[id]/variants — AI soạn 10 câu MỚI cùng điểm ngữ pháp, dùng từ người học đang học;
// một lần gọi thứ hai tự giải lại, chỉ giữ câu hai lần ra cùng đáp án (verified).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { generateVariants, solveExercises } from "@/lib/english/ai";
import { gradeAnswer } from "@/lib/english/grading";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const u = await prisma.engUnit.findFirst({ where: { id, ownerId: s.userId, status: "ready" }, select: { id: true, title: true, summaryVi: true, examples: true } });
  if (!u) return bad("Không tìm thấy bài (hoặc bài chưa xử lý xong)", 404);
  const existing = await prisma.engExercise.count({ where: { unitId: id, origin: "ai", flagged: false } });
  if (existing >= 40) return bad("Bài này đã có đủ câu luyện thêm.");
  if (!rateLimit(`eng-variants:${s.userId}`, 15, 60 * 60_000)) return bad("Đã soạn nhiều trong giờ này, thử lại sau.", 429);

  const vocab = await prisma.engUserWord.findMany({ where: { userId: s.userId, status: "learning" }, orderBy: { updatedAt: "desc" }, take: 30, select: { word: { select: { lemma: true } } } });
  try {
    const drafts = await generateVariants({ unitTitle: u.title, summaryVi: u.summaryVi ?? "", examples: Array.isArray(u.examples) ? (u.examples as string[]) : [], vocab: vocab.map(v => v.word.lemma), n: 10 });
    const solved = await solveExercises(drafts);
    const keep = drafts.filter((d, i) => solved[i] !== undefined && gradeAnswer(d.answers, solved[i]));
    if (!keep.length) return bad("Lần này AI chưa soạn được câu đủ chắc chắn, thử lại nhé.", 502);
    const base = await prisma.engExercise.count({ where: { unitId: id } });
    await prisma.engExercise.createMany({
      data: keep.map((e, i) => ({ ownerId: s.userId, unitId: id, type: e.type, instruction: e.instruction ?? null, prompt: e.prompt, options: e.options, answers: e.answers, explanation: e.explanation ?? null, origin: "ai", verified: true, order: base + i })),
    });
    return NextResponse.json({ ok: true, created: keep.length, dropped: drafts.length - keep.length });
  } catch (e) {
    console.error("[english.variants]", e);
    return bad("AI đang bận, thử lại sau.", 502);
  }
}
