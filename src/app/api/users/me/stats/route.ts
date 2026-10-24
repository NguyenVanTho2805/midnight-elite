import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { dropHeldResults } from "@/lib/examHold";

export async function GET() {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const [rawResults, lessonProgress] = await Promise.all([
    prisma.examResult.findMany({
      where: { userId: session.userId },
      orderBy: { completedAt: "asc" },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.userId, completed: true },
      select: { completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

  // Chỉ tính lượt đã công bố / đề không giữ điểm (examHold).
  const examResults = await dropHeldResults(rawResults);

  // GPA: average (score / totalPoints * 10), arrondi 1 décimale
  const gpa = examResults.length
    ? Math.round(examResults.reduce((s, r) => s + r.score / r.totalPoints * 10, 0) / examResults.length * 10) / 10
    : null;

  // EXP: 10 pts per completed lesson
  const exp = lessonProgress.length * 10;

  // Streak: consecutive days with at least 1 lesson completed (counting from today)
  const activityDays = new Set(
    lessonProgress.map(p => new Date(p.completedAt).toISOString().slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activityDays.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Rank: count users with best exam score higher than this user's best
  const myBest = examResults.length ? Math.max(...examResults.map(r => r.score)) : 0;
  let betterCount: number | null = null;
  if (myBest > 0) {
    const everyone = await dropHeldResults(await prisma.examResult.findMany({ select: { userId: true, examId: true, score: true } }));
    const bestByUser = new Map<string, number>();
    for (const r of everyone) bestByUser.set(r.userId, Math.max(bestByUser.get(r.userId) ?? 0, r.score));
    betterCount = [...bestByUser.values()].filter(b => b > myBest).length;
  }
  const rank = betterCount !== null ? betterCount + 1 : null;
  const totalStudents = await prisma.user.count({ where: { role: "student" } });

  return NextResponse.json({ gpa, streak, rank, totalStudents, exp });
}
