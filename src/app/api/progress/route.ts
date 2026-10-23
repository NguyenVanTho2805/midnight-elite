import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/progress — bài đã hoàn thành + đếm theo khoá + vị trí xem dở của bài chưa xong (MD-06: tách "đang xem" / "đã xong")
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ completedIds: [], byCourse: {}, watching: {}, positions: {} });

  const rows = await prisma.lessonProgress.findMany({
    where:  { userId: session.userId },
    select: {
      lessonId: true,
      completed: true,
      watchedSeconds: true,
      lesson: {
        select: {
          chapter: {
            select: {
              section: { select: { courseId: true } },
            },
          },
        },
      },
    },
  });

  const byCourse: Record<string, number> = {};
  const watching: Record<string, number> = {};
  const positions: Record<string, number> = {}; // vị trí xem (giây) của MỌI bài có xem, kể cả bài đã xong: để "xem tiếp"
  const completedIds: string[] = [];
  for (const r of rows) {
    if (r.watchedSeconds > 0) positions[r.lessonId] = r.watchedSeconds;
    if (!r.completed) {
      if (r.watchedSeconds > 0) watching[r.lessonId] = r.watchedSeconds;
      continue;
    }
    completedIds.push(r.lessonId);
    const courseId = r.lesson?.chapter?.section?.courseId;
    if (courseId) byCourse[courseId] = (byCourse[courseId] ?? 0) + 1;
  }

  return NextResponse.json({ completedIds, byCourse, watching, positions });
}
