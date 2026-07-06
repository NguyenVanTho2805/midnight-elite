import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  try {
    const results = await prisma.examResult.findMany({
      where: category ? { exam: { category } } : undefined,
      select: {
        userId: true, score: true,
        user: { select: { id: true, name: true, school: true } },
      },
    });

    const map = new Map<string, {
      userId: string; name: string; school: string | null;
      totalScore: number; count: number; best: number;
    }>();

    for (const r of results) {
      const existing = map.get(r.userId);
      if (existing) {
        existing.totalScore += r.score;
        existing.count++;
        existing.best = Math.max(existing.best, r.score);
      } else {
        map.set(r.userId, {
          userId: r.userId,
          name:   r.user.name,
          school: r.user.school,
          totalScore: r.score,
          count: 1,
          best:  r.score,
        });
      }
    }

    const leaderboard = [...map.values()]
      .map(({ totalScore, ...u }) => ({
        ...u,
        avg: Math.round(totalScore / u.count * 10) / 10,
      }))
      .sort((a, b) => b.best - a.best)
      .slice(0, 20);

    return NextResponse.json(leaderboard);
  } catch (e) {
    console.error("[GET /api/leaderboard]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
