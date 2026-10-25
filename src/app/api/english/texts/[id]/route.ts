// GET    /api/english/texts/[id] — bài + token đã tách (kèm lemma) + trạng thái từng lemma của TÔI + câu hỏi (không kèm đáp án)
// DELETE /api/english/texts/[id] — xoá bài của tôi (bài VOA công khai không xoá được)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { tokenize, coverage, coverageLevel, splitSentences } from "@/lib/english/text";
import { lemmatize, listEntry, bandOf } from "@/lib/english/lexicon";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const t = await prisma.engText.findFirst({
    where: { id, OR: [{ ownerId: null }, { ownerId: s.userId }] },
    include: { exercises: { where: { flagged: false }, orderBy: { order: "asc" }, select: { id: true, type: true, instruction: true, prompt: true, options: true } } },
  });
  if (!t) return bad("Không tìm thấy bài", 404);

  const tokens = tokenize(t.body, lemmatize);
  const lemmas = [...new Set(tokens.filter(x => x.isWord).map(x => x.lemma))];
  const mine = await prisma.engUserWord.findMany({
    where: { userId: s.userId, word: { lemma: { in: lemmas } } },
    select: { status: true, word: { select: { lemma: true } } },
  });
  const status: Record<string, string> = {};
  for (const m of mine) status[m.word.lemma] = m.status;
  const familiar = new Set(mine.filter(m => m.status !== "ignored").map(m => m.word.lemma));
  const cov = coverage(tokens, familiar);

  // Độ khó gợi ý cho từ chưa biết: từ NGSL/NAWL hoặc nhóm tần suất ≤ 5 thì đáng học; hiếm hơn thì "có thể bỏ qua".
  const worth: Record<string, boolean> = {};
  for (const l of cov.unknown) worth[l] = !!listEntry(l) || bandOf(l) <= 5;

  const attempts = t.exercises.length ? await prisma.engAttempt.findMany({
    where: { userId: s.userId, exerciseId: { in: t.exercises.map(e => e.id) } }, orderBy: { createdAt: "desc" }, select: { exerciseId: true, correct: true },
  }) : [];
  const last: Record<string, boolean> = {};
  for (const a of attempts) if (!(a.exerciseId in last)) last[a.exerciseId] = a.correct;

  return NextResponse.json({
    id: t.id, title: t.title, source: t.source, sourceUrl: t.sourceUrl, audioUrl: t.audioUrl, wordCount: t.wordCount,
    mine: t.ownerId === s.userId, license: t.license,
    sentences: splitSentences(t.body),
    // câu thứ i thuộc đoạn nào (để hiển thị đúng xuống dòng) — splitSentences tách đoạn trước rồi mới tách câu
    paraOf: t.body.replace(/\r/g, "").split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean).flatMap((p, pi) => splitSentences(p).map(() => pi)),
    tokens: tokens.map(x => (x.isWord ? [x.text, x.lemma, x.proper ? 1 : 0, x.sentence] : [x.text, "", 0, x.sentence])),
    status, worth,
    coverage: Math.round(cov.ratio * 1000) / 10, level: coverageLevel(cov.ratio), unknownCount: cov.unknown.length,
    exercises: t.exercises.map(e => ({ ...e, lastCorrect: last[e.id] ?? null })),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const t = await prisma.engText.findFirst({ where: { id, ownerId: s.userId }, select: { id: true } });
  if (!t) return bad("Chỉ xoá được bài do bạn thêm", 404);
  await prisma.engText.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
