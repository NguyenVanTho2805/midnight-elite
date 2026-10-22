// GET  /api/english/review — lượt ôn kế tiếp: thẻ đến hạn + từ mới của hôm nay (mở thẻ ngay khi lấy).
// POST /api/english/review — { cardId, rating? (1–4), answer? (thẻ bài tập), durationMs } → xếp lịch FSRS.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, ensureWordsSeeded, getProfile, bad, enrichMissing, ensureWordCard, logStudy } from "@/lib/english/server";
import { newWordsAllowed, previewIntervals, review, isGraduated, isMature, type RatingValue, type CardRow } from "@/lib/english/srs";
import { gradeAnswer } from "@/lib/english/grading";
import { vnDay } from "@/lib/english/day";

export const maxDuration = 60;
const BATCH = 30;

const cardSelect = {
  id: true, kind: true, cardType: true, wordId: true, exerciseId: true, due: true, stability: true, difficulty: true,
  elapsedDays: true, scheduledDays: true, learningSteps: true, reps: true, lapses: true, state: true, lastReview: true,
  word: { select: { lemma: true, pos: true, ipa: true, meaningVi: true, definitionEn: true, example: true } },
  exercise: { select: { type: true, instruction: true, prompt: true, options: true } },
} as const;

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  await ensureWordsSeeded();
  const profile = await getProfile(userId);
  const now = new Date();
  const dayStartUtc = new Date(Date.parse(vnDay(now) + "T00:00:00Z") - 7 * 3600_000);

  const [dueCount, newDoneToday] = await Promise.all([
    prisma.engCard.count({ where: { userId, suspended: false, due: { lte: now } } }),
    prisma.engUserWord.count({ where: { userId, source: "list", createdAt: { gte: dayStartUtc } } }),
  ]);

  // Mở từ mới theo thứ tự tần suất (NGSL + NAWL trộn theo độ phổ biến chung), bỏ từ đã có trong sổ.
  const allowed = newWordsAllowed({ dailyNew: profile.dailyNew, reviewCap: profile.dailyReviewCap, dueCount, newDoneToday });
  if (allowed > 0) {
    const fresh = await prisma.engWord.findMany({
      where: { list: { in: ["ngsl", "sup", "nawl"] }, userWords: { none: { userId } } },
      orderBy: [{ freqRank: { sort: "asc", nulls: "last" } }, { listRank: "asc" }],
      take: allowed, select: { id: true },
    });
    for (const w of fresh) {
      await prisma.engUserWord.create({ data: { userId, wordId: w.id, status: "learning", source: "list" } }).catch(() => null);
      await ensureWordCard(userId, w.id, "recognize", now);
    }
  }

  const cards = await prisma.engCard.findMany({
    where: { userId, suspended: false, due: { lte: new Date(now.getTime() + 60_000) } },
    orderBy: [{ due: "asc" }], take: BATCH, select: cardSelect,
  });
  await enrichMissing(cards.filter(c => c.wordId && !c.word?.meaningVi).map(c => c.wordId!));
  const missing = cards.filter(c => c.wordId && !c.word?.meaningVi).map(c => c.wordId!);
  const refreshed = missing.length ? await prisma.engWord.findMany({ where: { id: { in: missing } }, select: { id: true, lemma: true, pos: true, ipa: true, meaningVi: true, definitionEn: true, example: true } }) : [];
  const fix = new Map(refreshed.map(w => [w.id, w]));
  const ctx = await prisma.engUserWord.findMany({ where: { userId, wordId: { in: cards.map(c => c.wordId).filter((x): x is string => !!x) } }, select: { wordId: true, context: true, contextVi: true } });
  const ctxOf = new Map(ctx.map(c => [c.wordId, c]));

  const totalDue = await prisma.engCard.count({ where: { userId, suspended: false, due: { lte: now } } });
  return NextResponse.json({
    due: totalDue,
    cards: cards.map(c => ({
      id: c.id, kind: c.kind, cardType: c.cardType, isNew: c.reps === 0,
      word: c.wordId ? { ...(fix.get(c.wordId) ?? c.word), context: ctxOf.get(c.wordId)?.context ?? null, contextVi: ctxOf.get(c.wordId)?.contextVi ?? null } : null,
      exercise: c.exercise ?? null,
      preview: previewIntervals(c as CardRow, now),
    })),
  });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  const b = await req.json().catch(() => null) as { cardId?: string; rating?: number; answer?: string; durationMs?: number } | null;
  if (!b?.cardId) return bad("Thiếu thẻ");
  // Kiểm chủ sở hữu TRƯỚC mọi lệnh ghi.
  const card = await prisma.engCard.findFirst({ where: { id: b.cardId, userId }, include: { exercise: { select: { answers: true, explanation: true } } } });
  if (!card) return bad("Không tìm thấy thẻ", 404);

  let rating: RatingValue;
  let correct: boolean | null = null;
  if (card.kind === "exercise") {
    if (typeof b.answer !== "string") return bad("Cần câu trả lời");
    correct = gradeAnswer(card.exercise?.answers ?? [], b.answer);
    rating = correct ? 3 : 1;
    if (card.exerciseId) await prisma.engAttempt.create({ data: { userId, exerciseId: card.exerciseId, answer: b.answer.slice(0, 500), correct } });
  } else {
    if (![1, 2, 3, 4].includes(Number(b.rating))) return bad("Mức nhớ không hợp lệ");
    rating = Number(b.rating) as RatingValue;
  }
  // Bấm hai lần (mạng chậm): nếu thẻ vừa được ôn trong 3 giây qua thì không xếp lịch lần nữa.
  if (card.lastReview && Date.now() - card.lastReview.getTime() < 3000) return NextResponse.json({ ok: true, duplicate: true, correct, due: card.due });

  const now = new Date();
  const { row, log } = review(card as CardRow, rating, now);
  await prisma.$transaction([
    prisma.engCard.update({ where: { id: card.id }, data: row }),
    prisma.engReviewLog.create({ data: { cardId: card.id, userId, rating: log.rating, state: log.state, elapsedDays: log.elapsedDays, scheduledDays: log.scheduledDays, durationMs: b.durationMs ? Math.min(Math.round(b.durationMs), 600000) : null } }),
  ]);

  if (card.kind === "word" && card.wordId) {
    // Thẻ nhận diện "tốt nghiệp" → mở thẻ nhớ chủ động (gõ từ tiếng Anh từ nghĩa tiếng Việt) từ ngày mai.
    if (card.cardType === "recognize" && isGraduated(row) && !isGraduated(card as CardRow)) {
      await ensureWordCard(userId, card.wordId, "recall", new Date(now.getTime() + 86400_000));
    }
    if (card.cardType === "recall" && isMature(row)) {
      await prisma.engUserWord.updateMany({ where: { userId, wordId: card.wordId }, data: { status: "known" } });
    }
  }
  if (card.kind === "exercise" && correct && isMature(row)) {
    await prisma.engCard.update({ where: { id: card.id }, data: { suspended: true } }); // làm đúng lâu rồi → thôi ôn câu này
  }

  await logStudy(userId, "tu-vung", { items: 1, correct: rating >= 3 ? 1 : 0, total: 1, seconds: b.durationMs ? Math.round(Math.min(b.durationMs, 120000) / 1000) : 0 });
  return NextResponse.json({
    ok: true, correct, due: row.due,
    ...(card.kind === "exercise" ? { answers: card.exercise?.answers ?? [], explanation: card.exercise?.explanation ?? null } : {}),
  });
}
