import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  const { id: courseId } = await params;

  // Lấy tất cả lesson IDs của khoá học
  const courseData = await prisma.course.findUnique({
    where:  { id: courseId },
    select: {
      ownerId: true,
      lessons: true,
      sections: { select: { chapters: { select: { lessons: { select: { id: true } } } } } },
    },
  });
  if (!courseData) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
  if (!ownsResource(auth, courseData.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  const allLessonIds = courseData?.sections
    .flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))) ?? [];
  const totalLessons = allLessonIds.length;

  // 2 queries thay vì N+1: enrollments + groupBy progress
  const [enrollments, progressGroups] = await Promise.all([
    prisma.enrollment.findMany({
      where:   { courseId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, school: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    totalLessons > 0
      ? prisma.lessonProgress.groupBy({
          by:    ["userId"],
          where: { lessonId: { in: allLessonIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const progressMap = new Map(
    (progressGroups as { userId: string; _count: { _all: number } }[]).map(p => [p.userId, p._count._all])
  );

  const students = enrollments.map(e => {
    const completed = progressMap.get(e.userId) ?? 0;
    return {
      userId:      e.userId,
      name:        e.user.name,
      email:       e.user.email,
      phone:       e.user.phone,
      school:      e.user.school,
      enrolledAt:  e.createdAt,
      completed,
      totalLessons,
      progress: totalLessons > 0 ? Math.round(completed * 100 / totalLessons) : 0,
    };
  });

  return NextResponse.json({ students, total: students.length });
}
