// GET /api/english/today — màn "Hôm nay": thẻ đến hạn, từ mới còn lại, chuỗi ngày, phút học, bài gợi ý, unit đang học.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, ensureWordsSeeded, getProfile, familiarLemmas } from "@/lib/english/server";
import { computeStreak, vnDay, addDays } from "@/lib/english/day";
import { newWordsAllowed } from "@/lib/english/srs";
import { tokenize, coverage, coverageLevel } from "@/lib/english/text";
import { lemmatize } from "@/lib/english/lexicon";
import { dayBlock, planPosition } from "@/lib/english/plan";
import { componentTargets } from "@/lib/english/mock";

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  await ensureWordsSeeded();
  const profile = await getProfile(userId);
  const now = new Date();
  const today = vnDay(now);
  const dayStartUtc = new Date(Date.parse(today + "T00:00:00Z") - 7 * 3600_000);

  const [dueCount, newDoneToday, logs, knownCount, learningCount, lastProgress, lastWriting, mocks] = await Promise.all([
    prisma.engCard.count({ where: { userId, suspended: false, due: { lte: now } } }),
    prisma.engUserWord.count({ where: { userId, source: "list", createdAt: { gte: dayStartUtc } } }),
    prisma.engStudyLog.findMany({ where: { userId, day: { gte: addDays(today, -90) } }, select: { day: true, module: true, seconds: true, items: true } }),
    prisma.engUserWord.count({ where: { userId, status: "known" } }),
    prisma.engUserWord.count({ where: { userId, status: "learning" } }),
    prisma.engUnitProgress.findFirst({ where: { userId }, orderBy: { lastStudiedAt: "desc" }, select: { unitId: true, bestScore: true, unit: { select: { title: true, unitNo: true, bookId: true, order: true, book: { select: { title: true } } } } } }),
    prisma.engWriting.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { bandLow: true, bandHigh: true, createdAt: true } }),
    prisma.engMock.findMany({ where: { userId, skill: { in: ["listening", "reading"] } }, orderBy: { takenAt: "desc" }, take: 20, select: { skill: true, band: true, takenAt: true } }),
  ]);

  const activeDays = [...new Set(logs.filter(l => l.items > 0 || l.seconds > 0).map(l => l.day))];
  const streak = computeStreak(activeDays, today);
  const minutesToday = Math.round(logs.filter(l => l.day === today).reduce((n, l) => n + l.seconds, 0) / 60);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => ({
    day: d, minutes: Math.round(logs.filter(l => l.day === d).reduce((n, l) => n + l.seconds, 0) / 60),
  }));

  // Unit kế tiếp: unit sau unit học gần nhất (nếu điểm ≥ 80%), không thì học lại chính nó.
  let nextUnit: { id: string; label: string; bookTitle: string } | null = null;
  if (lastProgress) {
    const u = lastProgress.unit;
    const next = lastProgress.bestScore >= 80
      ? await prisma.engUnit.findFirst({ where: { bookId: u.bookId, order: { gt: u.order }, status: "ready" }, orderBy: { order: "asc" }, select: { id: true, title: true, unitNo: true } })
      : null;
    const pick = next ?? { id: lastProgress.unitId, title: u.title, unitNo: u.unitNo };
    nextUnit = { id: pick.id, label: pick.unitNo ? `Unit ${pick.unitNo}: ${pick.title}` : pick.title, bookTitle: u.book.title };
  }

  // Bài đọc gợi ý: trong 40 bài mới nhất người này xem được, chọn bài có độ phủ 95–98% trước.
  const texts = await prisma.engText.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }], source: { not: "book" } },
    orderBy: { createdAt: "desc" }, take: 40, select: { id: true, title: true, body: true, wordCount: true, source: true },
  });
  const familiar = await familiarLemmas(userId);
  const scored = texts.map(t => {
    const c = coverage(tokenize(t.body, lemmatize), familiar);
    return { id: t.id, title: t.title, wordCount: t.wordCount, source: t.source, coverage: Math.round(c.ratio * 1000) / 10, level: coverageLevel(c.ratio) };
  });
  const order = { hoc: 0, nhe: 1, kho: 2 } as const;
  const suggestions = scored.sort((a, b) => order[a.level] - order[b.level] || b.coverage - a.coverage).slice(0, 3);

  const examDays = profile.examDate ? Math.round((Date.parse(profile.examDate) - Date.parse(today)) / 86400_000) : null;

  // Lộ trình 26 tuần: chặng hiện tại, khối kỹ năng hôm nay, mốc thi thử kế tiếp + điểm L/R gần nhất để so ngưỡng.
  const pos = planPosition(profile.examDate, today);
  const lastL = mocks.find(m => m.skill === "listening") ?? null;
  const lastR = mocks.find(m => m.skill === "reading") ?? null;
  const t = profile.targetBand;
  const plan = {
    hasExam: pos.hasExam, week: pos.week, beforeWindow: pos.beforeWindow, afterExam: pos.afterExam,
    phase: { key: pos.phase.key, name: pos.phase.name, from: pos.phase.from, to: pos.phase.to, bandFrom: Math.max(1, pos.phase.bandFrom(t)), bandTo: pos.phase.bandTo(t), focus: pos.phase.focus, split: pos.phase.split },
    today: dayBlock(today, pos),
    nextGate: pos.nextGate ? { week: pos.nextGate.week, label: pos.nextGate.label, weeksAway: pos.nextGate.weeksAway, min: pos.nextGate.min(t), rule: pos.nextGate.rule, ifFail: pos.nextGate.ifFail } : null,
    lastMock: { listening: lastL?.band ?? null, reading: lastR?.band ?? null },
    targets: componentTargets(t),
  };

  return NextResponse.json({
    today, profile, examDays,
    review: { due: dueCount, newLeft: newWordsAllowed({ dailyNew: profile.dailyNew, reviewCap: profile.dailyReviewCap, dueCount, newDoneToday }), newDoneToday },
    words: { known: knownCount, learning: learningCount },
    streak, minutesToday, week, nextUnit, suggestions, plan,
    lastWriting: lastWriting ? { bandLow: lastWriting.bandLow, bandHigh: lastWriting.bandHigh, createdAt: lastWriting.createdAt } : null,
  });
}
