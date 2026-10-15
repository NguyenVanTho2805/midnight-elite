// GET  /api/english/placement — đề xếp lớp từ vựng: 16 từ mỗi nhóm × 6 nhóm + 10 từ giả, xáo trộn.
// POST /api/english/placement — { answers: [{ lemma, known }] } → đánh dấu từ đã biết, mở thẻ cho từ chưa biết ở nhóm đã thuộc.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, ensureWordsSeeded, getProfile, bad, ensureWordCard } from "@/lib/english/server";
import { allListEntries, PSEUDOWORDS } from "@/lib/english/lexicon";
import { PLACEMENT_BANDS, SAMPLE_PER_BAND, scorePlacement, seededSample, type PlacementAnswer } from "@/lib/english/placement";

function bandOfEntry(lemma: string): string | null {
  const e = allListEntries().find(x => x.lemma === lemma);
  if (!e || e.listRank == null) return null;
  const b = PLACEMENT_BANDS.find(b => b.list === (e.list === "nawl" ? "nawl" : "ngsl") && e.listRank! >= b.from && e.listRank! <= b.to);
  return b?.key ?? null;
}

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const seed = [...s.userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, Date.now() % 100000);
  const entries = allListEntries();
  const items: { lemma: string }[] = [];
  PLACEMENT_BANDS.forEach((b, i) => {
    const pool = entries.filter(e => (b.list === "nawl" ? e.list === "nawl" : e.list === "ngsl") && e.listRank != null && e.listRank >= b.from && e.listRank <= b.to);
    items.push(...seededSample(pool, SAMPLE_PER_BAND, seed + i * 7919).map(e => ({ lemma: e.lemma })));
  });
  items.push(...PSEUDOWORDS.map(lemma => ({ lemma })));
  return NextResponse.json({ items: seededSample(items, items.length, seed + 1) });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  const b = await req.json().catch(() => null) as { answers?: { lemma?: unknown; known?: unknown }[] } | null;
  if (!b || !Array.isArray(b.answers) || b.answers.length < 20 || b.answers.length > 200) return bad("Cần trả lời đủ bài kiểm tra");
  await ensureWordsSeeded();

  const fake = new Set(PSEUDOWORDS);
  const answers: PlacementAnswer[] = [];
  for (const a of b.answers) {
    const lemma = String(a.lemma ?? "").toLowerCase();
    const band = fake.has(lemma) ? "fake" : bandOfEntry(lemma);
    if (band) answers.push({ lemma, band, known: a.known === true });
  }
  const result = scorePlacement(answers);
  const mastered = PLACEMENT_BANDS.filter((_, i) => result.bands[i].mastered);

  // 1) Nhóm đã thuộc: cả nhóm coi là đã biết (trừ những từ người học vừa nói "không biết").
  const saidNo = new Set(answers.filter(a => a.band !== "fake" && !a.known).map(a => a.lemma));
  const saidYes = new Set(answers.filter(a => a.band !== "fake" && a.known).map(a => a.lemma));
  const knownLemmas = new Set<string>(saidYes);
  for (const band of mastered) {
    for (const e of allListEntries()) {
      if ((band.list === "nawl" ? e.list === "nawl" : e.list === "ngsl") && e.listRank != null && e.listRank >= band.from && e.listRank <= band.to && !saidNo.has(e.lemma)) knownLemmas.add(e.lemma);
    }
  }
  // từ bổ sung (số đếm, tháng) coi như biết nếu nhóm đầu đã thuộc
  if (mastered.some(m => m.key === "n1")) for (const e of allListEntries()) if (e.list === "sup") knownLemmas.add(e.lemma);

  const words = await prisma.engWord.findMany({ where: { lemma: { in: [...knownLemmas, ...saidNo] } }, select: { id: true, lemma: true } });
  const idOf = new Map(words.map(w => [w.lemma, w.id]));
  const knownIds = [...knownLemmas].map(l => idOf.get(l)).filter((x): x is string => !!x);
  for (let i = 0; i < knownIds.length; i += 1000) {
    await prisma.engUserWord.createMany({ data: knownIds.slice(i, i + 1000).map(wordId => ({ userId, wordId, status: "known", source: "placement" })), skipDuplicates: true });
  }
  // 2) Từ nói "không biết" ở nhóm đã thuộc → học ngay (lỗ hổng trong vùng đáng lẽ đã chắc).
  const masteredKeys = new Set(mastered.map(m => m.key));
  const gaps = answers.filter(a => !a.known && a.band !== "fake" && masteredKeys.has(a.band)).map(a => idOf.get(a.lemma)).filter((x): x is string => !!x);
  for (const wordId of gaps) {
    await prisma.engUserWord.upsert({ where: { userId_wordId: { userId, wordId } }, create: { userId, wordId, status: "learning", source: "placement" }, update: { status: "learning" } });
    await ensureWordCard(userId, wordId, "recognize");
  }
  await getProfile(userId);
  await prisma.engProfile.update({ where: { userId }, data: { placementDone: true } });

  return NextResponse.json({
    bands: result.bands.map((r, i) => ({ ...r, label: PLACEMENT_BANDS[i].label })),
    falseAlarm: result.falseAlarm,
    estimatedKnown: result.estimatedKnown,
    markedKnown: knownIds.length,
    gaps: gaps.length,
  });
}
