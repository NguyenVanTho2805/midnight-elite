import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { suspendedCourseIds } from "@/lib/suspendedContentServer";
import { PUBLISHED_ONLY } from "@/lib/lessonStatus";

// GET /api/progress — bài đã hoàn thành + đếm theo khoá + vị trí xem dở của bài chưa xong (MD-06: tách "đang xem" / "đã xong")
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ completedIds: [], byCourse: {}, watching: {}, positions: {} });

  // Đã nghỉ lớp (quyết định 06/11/2026): tiến độ của lớp đó không còn hiện (bài miễn phí thì giữ). Dữ liệu vẫn nằm trong DB cho gia sư / khi cho học lại.
  const left = new Set(await suspendedCourseIds(session.userId));
  const all = await prisma.lessonProgress.findMany({
    where:  { userId: session.userId, lesson: PUBLISHED_ONLY },   // BU-02-PHẲNG (R8): bài Ẩn/Nháp không đếm vào completedIds/byCourse/positions
    select: {
      lessonId: true,
      completed: true,
      watchedSeconds: true,
      lesson: {
        select: {
          isFree: true,
          chapter: {
            select: {
              section: { select: { courseId: true } },
            },
          },
        },
      },
    },
  });

  const rows = left.size === 0 ? all : all.filter(r => r.lesson?.isFree === true || !left.has(r.lesson?.chapter?.section?.courseId ?? ""));

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
