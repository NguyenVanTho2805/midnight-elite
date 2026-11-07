import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, hasAssignmentInCourse } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  // TUT-dong-giang: đồng giảng / bộ môn xem được tên + trạng thái + tiến độ; KHÔNG có email, SĐT, trường (TRẺ EM, chờ chủ Q3). Bộ môn chưa được giao gì chỉ thấy SỐ LƯỢNG.
  const acc = await requireCourseAccess(courseId, "roster.view");
  if (!acc.ok) return acc.res;
  const withContact = canDo(acc.role, "roster.contact");
  const namesVisible = acc.role !== "subject_teacher" || (await hasAssignmentInCourse(courseId, acc.session.userId));

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

  const allLessonIds = courseData?.sections
    .flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => l.id))) ?? [];
  const totalLessons = allLessonIds.length;

  // 2 queries thay vì N+1: enrollments + groupBy progress
  const [enrollments, progressGroups] = await Promise.all([
    prisma.enrollment.findMany({
      where:   { courseId },
      include: {
        user: { select: withContact ? { id: true, name: true, email: true, phone: true, school: true, createdAt: true } : { id: true, name: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    totalLessons > 0
      ? prisma.lessonProgress.groupBy({
          by:    ["userId"],
          where: { lessonId: { in: allLessonIds }, completed: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const progressMap = new Map(
    (progressGroups as { userId: string; _count: { _all: number } }[]).map(p => [p.userId, p._count._all])
  );

  const students = enrollments.map(e => {
    const completed = progressMap.get(e.userId) ?? 0;
    const u = e.user as { name: string; email?: string; phone?: string | null; school?: string | null };
    return {
      userId:      e.userId,
      status:      e.status,
      name:        u.name,
      ...(withContact ? { email: u.email, phone: u.phone, school: u.school } : {}),
      enrolledAt:  e.createdAt,
      completed,
      totalLessons,
      progress: totalLessons > 0 ? Math.round(completed * 100 / totalLessons) : 0,
    };
  });

  if (!namesVisible) return NextResponse.json({ students: [], total: students.length, namesHidden: true });
  return NextResponse.json({ students, total: students.length });
}
