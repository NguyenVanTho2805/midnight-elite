import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/auth-guard";
import { calendarDaysLeft, parseAzotaDeadline } from "@/lib/azotaDeadline";
import { firstHttpLink } from "@/lib/lessonLinks";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 200 });

  try {
    // admin_super/admin_content thấy tất cả khoá học; teacher chỉ thấy khoá do
    // mình tạo (ownerScopeWhere); student chỉ thấy khoá đã enroll
    let courseIds: string[];
    if (session.role === "admin") {
      const visibleCourses = await prisma.course.findMany({ where: ownerScopeWhere(session), select: { id: true } });
      courseIds = visibleCourses.map(c => c.id);
    } else {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: session.userId, status: "active" },
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

    // MD-16: hạn đọc theo GIỜ VIỆT NAM (chuỗi "YYYY-MM-DDTHH:mm" không có múi giờ = giờ VN), không phụ thuộc múi giờ máy chủ.
    // Hạn không đọc được thì bỏ khỏi danh sách (không đoán).
    const deadlines = lessons
      .flatMap(l => {
        const dl = parseAzotaDeadline(l.azotaDeadline);
        if (!dl) return [];
        const diffMs   = dl.instant.getTime() - now.getTime();
        const diffDays = calendarDaysLeft(dl, now);
        const course   = l.chapter.section.course;

        return [{
          lessonId:     l.id,
          lessonTitle:  l.title,
          chapterTitle: l.chapter.title,
          courseName:   course.name,
          courseId:     course.id,
          category:     course.category,
          azotaUrl:     firstHttpLink(l.azotaUrl),
          deadline:     l.azotaDeadline,
          deadlineFormatted: `${dl.time} ${dl.dateKey.slice(8, 10)}/${dl.dateKey.slice(5, 7)}`,
          daysLeft:     diffDays,
          isExpired:    diffMs < 0,
          isUrgent:     diffDays <= 1 && diffMs >= 0,
        }];
      })
      .filter(d => !d.isExpired); // Chỉ hiện deadline chưa hết hạn

    return NextResponse.json(deadlines);
  } catch (e) {
    console.error("[GET /api/deadlines]", e);
    return NextResponse.json([]);
  }
}
