// GET /api/english/progress — trang Tiến độ: giờ học so với kế hoạch, 12 tuần gần nhất theo kỹ năng, độ chính xác chép chính tả,
// sức nhớ từ vựng, điểm thi thử + Writing theo thời gian, và Sổ lỗi (câu làm sai gần đây mà lần làm cuối vẫn sai).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, getProfile } from "@/lib/english/server";
import { addDays, vnDay, weekStart } from "@/lib/english/day";
import { plannedHours } from "@/lib/english/plan";

const WEEKS = 12;

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const userId = s.userId;
  const profile = await getProfile(userId);
  const today = vnDay();
  const firstWeek = addDays(weekStart(today), -(WEEKS - 1) * 7);
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const since60 = new Date(Date.now() - 60 * 86400_000);

  const [allTime, logs, known, learning, mature, reviews, mocks, writings, attempts, redoDue] = await Promise.all([
    prisma.engStudyLog.aggregate({ where: { userId }, _sum: { seconds: true } }),
    prisma.engStudyLog.findMany({ where: { userId, day: { gte: firstWeek } }, select: { day: true, module: true, seconds: true, correct: true, total: true } }),
    prisma.engUserWord.count({ where: { userId, status: "known" } }),
    prisma.engUserWord.count({ where: { userId, status: "learning" } }),
    prisma.engCard.count({ where: { userId, kind: "word", cardType: "recognize", suspended: false, state: 2, scheduledDays: { gte: 21 } } }),
    prisma.engReviewLog.findMany({ where: { userId, reviewedAt: { gte: since30 }, card: { kind: "word" } }, select: { rating: true, state: true } }),
    prisma.engMock.findMany({ where: { userId }, orderBy: { takenAt: "asc" }, take: 200, select: { skill: true, band: true, raw: true, title: true, takenAt: true } }),
    prisma.engWriting.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 60, select: { createdAt: true, bandLow: true, bandHigh: true, taskType: true } }),
    prisma.engAttempt.findMany({
      where: { userId, createdAt: { gte: since60 } }, orderBy: { createdAt: "desc" }, take: 800,
      select: {
        exerciseId: true, answer: true, correct: true, createdAt: true,
        exercise: { select: { prompt: true, instruction: true, answers: true, explanation: true, flagged: true, unitId: true, textId: true,
          unit: { select: { title: true, unitNo: true, book: { select: { title: true } } } }, text: { select: { title: true } } } },
      },
    }),
    prisma.engCard.count({ where: { userId, kind: "exercise", suspended: false, due: { lte: new Date() } } }),
  ]);

  // ── Tuần ────────────────────────────────────────────────────────────────
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(firstWeek, i * 7)).map(start => {
    const end = addDays(start, 7);
    const rows = logs.filter(l => l.day >= start && l.day < end);
    const byModule: Record<string, number> = {};
    for (const r of rows) byModule[r.module] = (byModule[r.module] ?? 0) + Math.round(r.seconds / 60);
    const dict = rows.filter(r => r.module === "nghe");
    return {
      start, minutes: Math.round(rows.reduce((n, r) => n + r.seconds, 0) / 60), byModule,
      activeDays: new Set(rows.filter(r => r.seconds > 0).map(r => r.day)).size,
      dictation: { correct: dict.reduce((n, r) => n + r.correct, 0), total: dict.reduce((n, r) => n + r.total, 0) },
    };
  });

  // ── Từ vựng: tỉ lệ nhớ khi ôn thẻ đã vào lịch dài (state Review) trong 30 ngày ──
  const matureReviews = reviews.filter(r => r.state === 2);
  const retention = matureReviews.length ? Math.round((matureReviews.filter(r => r.rating >= 3).length / matureReviews.length) * 100) : null;

  // ── Sổ lỗi: lần làm cuối của mỗi câu vẫn sai ─────────────────────────────
  const lastByEx = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!lastByEx.has(a.exerciseId)) lastByEx.set(a.exerciseId, a);
  const open = [...lastByEx.values()].filter(a => !a.correct && !a.exercise.flagged);
  const groups = new Map<string, { key: string; label: string; href: string; items: { exerciseId: string; instruction: string | null; prompt: string; yourAnswer: string; answers: string[]; explanation: string | null; at: Date }[] }>();
  for (const a of open) {
    const ex = a.exercise;
    const key = ex.unitId ? `u:${ex.unitId}` : ex.textId ? `t:${ex.textId}` : "khac";
    if (!groups.has(key)) {
      const label = ex.unit ? `${ex.unit.book.title} — ${ex.unit.unitNo ? `Unit ${ex.unit.unitNo}: ` : ""}${ex.unit.title}` : ex.text ? `Bài đọc: ${ex.text.title}` : "Khác";
      const href = ex.unitId ? `/student/tieng-anh/lop-hoc/bai/${ex.unitId}` : ex.textId ? `/student/tieng-anh/doc/${ex.textId}` : "/student/tieng-anh";
      groups.set(key, { key, label, href, items: [] });
    }
    groups.get(key)!.items.push({ exerciseId: a.exerciseId, instruction: ex.instruction, prompt: ex.prompt, yourAnswer: a.answer, answers: ex.answers, explanation: ex.explanation, at: a.createdAt });
  }

  return NextResponse.json({
    today, targetBand: profile.targetBand,
    hours: {
      total: Math.round(((allTime._sum.seconds ?? 0) / 3600) * 10) / 10,
      planned: plannedHours(profile.dailyMinutes),
      weekTargetMinutes: profile.dailyMinutes * 6,
      last7: Math.round((logs.filter(l => l.day > addDays(today, -7)).reduce((n, l) => n + l.seconds, 0) / 3600) * 10) / 10,
    },
    weeks,
    vocab: { known, learning, mature, reviews30: reviews.length, retention },
    mocks, writings,
    errors: { total: open.length, redoDue, groups: [...groups.values()].sort((a, b) => b.items.length - a.items.length) },
  });
}
