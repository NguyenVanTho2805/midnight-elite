import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category"); // optional filter

  // Top học viên dựa trên điểm thi thử cao nhất (thang điểm thống nhất 150 toàn hệ thống)
  // Lấy TẤT CẢ kết quả phù hợp rồi mới gộp theo user — lấy top-N trước khi gộp sẽ làm sai avg/count
  const results = await prisma.examResult.findMany({
    where: category ? { exam: { category } } : undefined,
    select: {
      userId: true, score: true,
      user: { select: { id: true, name: true, school: true } },
    },
  });

  // Gộp theo user — lấy điểm trung bình + số đề đã thi
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
    .map(u => ({
      ...u,
      avg: Math.round(u.totalScore / u.count * 10) / 10,
    }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 20);

  return NextResponse.json(leaderboard);
}
