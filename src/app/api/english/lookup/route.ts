// POST /api/english/lookup — { word, sentence } → nghĩa tiếng Việt ĐÚNG trong câu (AI, có bộ nhớ đệm theo từ + câu).
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { lemmatize, listEntry, freqRank } from "@/lib/english/lexicon";
import { lookupInContext } from "@/lib/english/ai";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as { word?: string; sentence?: string } | null;
  const word = (b?.word ?? "").trim().toLowerCase();
  const sentence = (b?.sentence ?? "").trim().slice(0, 600);
  if (!/^[a-z][a-z'’-]{0,40}$/.test(word)) return bad("Từ không hợp lệ");
  const lemma = lemmatize(word);
  const key = createHash("sha1").update(`${lemma}|${sentence}`).digest("hex");

  const dict = await prisma.engWord.findUnique({ where: { lemma }, select: { meaningVi: true, pos: true, ipa: true, example: true } });
  const cached = await prisma.engLookup.findUnique({ where: { key } });
  if (cached) return NextResponse.json({ lemma, meaningVi: cached.meaningVi, note: cached.note, dict, list: listEntry(lemma)?.list ?? null, freqRank: freqRank(lemma) ?? null, cached: true });

  if (!rateLimit(`eng-lookup:${s.userId}`, 60, 10 * 60_000)) return bad("Tra quá nhanh, nghỉ một chút rồi tra tiếp nhé.", 429);
  try {
    const r = await lookupInContext(word, sentence || word);
    const meaningVi = (r.meaningVi ?? "").slice(0, 200);
    const note = r.note?.slice(0, 300) || null;
    if (meaningVi) await prisma.engLookup.upsert({ where: { key }, create: { key, lemma, meaningVi, note }, update: {} });
    return NextResponse.json({ lemma, meaningVi, note, dict, list: listEntry(lemma)?.list ?? null, freqRank: freqRank(lemma) ?? null, cached: false });
  } catch (e) {
    console.error("[english.lookup]", e);
    // AI lỗi vẫn trả nghĩa từ điển nếu có — không để người học bị kẹt giữa bài.
    return NextResponse.json({ lemma, meaningVi: dict?.meaningVi ?? null, note: null, dict, list: listEntry(lemma)?.list ?? null, freqRank: freqRank(lemma) ?? null, aiError: true });
  }
}
