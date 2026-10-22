// POST /api/english/texts/[id]/finish — { lemmas: string[], seconds } đọc xong: các từ người học KHÔNG bấm vào (và tự xác nhận)
// được đánh dấu "đã biết". Chỉ nhận lemma thật sự có trong bài; không hạ từ đang học xuống "đã biết".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, logStudy } from "@/lib/english/server";
import { tokenize } from "@/lib/english/text";
import { lemmatize, listEntry, freqRank } from "@/lib/english/lexicon";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const t = await prisma.engText.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: s.userId }] }, select: { body: true, wordCount: true } });
  if (!t) return bad("Không tìm thấy bài", 404);
  const b = await req.json().catch(() => null) as { lemmas?: unknown; seconds?: number } | null;
  const inText = new Set(tokenize(t.body, lemmatize).filter(x => x.isWord && !x.proper).map(x => x.lemma));
  const lemmas = (Array.isArray(b?.lemmas) ? b!.lemmas : []).map(String).filter(l => inText.has(l) && /^[a-z][a-z'-]*$/.test(l)).slice(0, 300);

  let marked = 0;
  if (lemmas.length) {
    await prisma.engWord.createMany({
      data: lemmas.map(l => ({ lemma: l, list: listEntry(l)?.list ?? "own", listRank: listEntry(l)?.listRank ?? null, freqRank: freqRank(l) ?? null })),
      skipDuplicates: true,
    });
    const words = await prisma.engWord.findMany({ where: { lemma: { in: lemmas } }, select: { id: true } });
    const r = await prisma.engUserWord.createMany({ data: words.map(w => ({ userId: s.userId, wordId: w.id, status: "known", source: "finish", textId: id })), skipDuplicates: true });
    marked = r.count;
  }
  await logStudy(s.userId, "doc", { items: 1, seconds: Math.min(Number(b?.seconds) || 0, 3600) });
  return NextResponse.json({ ok: true, marked });
}
