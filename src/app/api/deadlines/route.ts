import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 200 });

  try {
    // Admin thấy tất cả khoá học; student chỉ thấy khoá đã enroll
    let courseIds: string[];
    if (session.role === "admin") {
      const allCourses = await prisma.course.findMany({ select: { id: true } });
      courseIds = allCourses.map(c => c.id);
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: session.userId },
        select: { courseId: true },
      });
      if (!enrollments.length) return NextResponse.json([]);
      courseIds = enrollments.map(e => e.courseId);
    }

    // Lấy tất cả lessons có azotaDeadline trong các khoá đã enroll
    const lessons = await prisma.lesson.findMany({
      where: {
        azotaDeadline: { not: null },
        chapter: {
          section: { courseId: { in: courseIds } },
        },
      },
      select: {
        id: true,
        title: true,
        azotaUrl: true,
        azotaDeadline: true,
        chapter: {
          select: {
            title: true,
            section: {
              select: {
                course: { select: { id: true, name: true, category: true } },
              },
            },
          },
        },
      },
      orderBy: { azotaDeadline: "asc" },
    });

    const now = new Date();

    const deadlines = lessons
      .filter(l => l.azotaDeadline)
      .map(l => {
        const deadline = new Date(l.azotaDeadline!);
        const diffMs   = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const course   = l.chapter.section.course;

        return {
          lessonId:     l.id,
          lessonTitle:  l.title,
          chapterTitle: l.chapter.title,
          courseName:   course.name,
          courseId:     course.id,
          category:     course.category,
          azotaUrl:     l.azotaUrl,
          deadline:     l.azotaDeadline,
          deadlineFormatted: deadline.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
          daysLeft:     diffDays,
          isExpired:    diffMs < 0,
          isUrgent:     diffDays <= 1 && diffMs >= 0,
        };
      })
      .filter(d => !d.isExpired); // Chỉ hiện deadline chưa hết hạn

    return NextResponse.json(deadlines);
  } catch (e) {
    console.error("[GET /api/deadlines]", e);
    return NextResponse.json([]);
  }
}
