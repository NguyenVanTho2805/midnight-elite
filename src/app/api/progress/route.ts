import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/progress — lấy tất cả lesson đã hoàn thành + byCourse count
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ completedIds: [], byCourse: {} });

  const rows = await prisma.lessonProgress.findMany({
    where:  { userId: session.userId },
    select: {
      lessonId: true,
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
  for (const r of rows) {
    const courseId = r.lesson?.chapter?.section?.courseId;
    if (courseId) byCourse[courseId] = (byCourse[courseId] ?? 0) + 1;
  }

  return NextResponse.json({ completedIds: rows.map(r => r.lessonId), byCourse });
}
