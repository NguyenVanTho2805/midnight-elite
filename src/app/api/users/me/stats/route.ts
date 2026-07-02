import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";

export async function GET() {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const [examResults, lessonProgress] = await Promise.all([
    prisma.examResult.findMany({
      where: { userId: session.userId },
      orderBy: { completedAt: "asc" },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.userId },
      select: { completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
  ]);

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
  const betterCount = myBest > 0
    ? await prisma.examResult.groupBy({
        by: ["userId"],
        _max: { score: true },
        having: { score: { _max: { gt: myBest } } },
      }).then(r => r.length)
    : null;
  const rank = betterCount !== null ? betterCount + 1 : null;
  const totalStudents = await prisma.user.count({ where: { role: "student" } });

  return NextResponse.json({ gpa, streak, rank, totalStudents, exp });
}
