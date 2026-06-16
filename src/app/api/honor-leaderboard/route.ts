import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCompletion, computeGpa } from "@/lib/gpa";

export async function GET() {
  try {
    const students = await prisma.user.findMany({
      where: { role: "student", enrollments: { some: {} } },
      select: {
        id:     true,
        name:   true,
        school: true,
        enrollments: {
          select: {
            courseId: true,
            course: { select: { lessons: true } },
          },
        },
        lessonProgress: { select: { lessonId: true } },
        examResults: {
          select: { score: true, totalPoints: true },
        },
      },
    });

    // Build courseId → Set<lessonId> in ONE query (không N+1)
    const allCourseIds = [...new Set(students.flatMap(s => s.enrollments.map(e => e.courseId)))];
    const courseLessons = allCourseIds.length > 0
      ? await prisma.lesson.findMany({
          where: { chapter: { section: { courseId: { in: allCourseIds } } } },
          select: { id: true, chapter: { select: { section: { select: { courseId: true } } } } },
        })
      : [];

    const lessonToCourse = new Map(courseLessons.map(l => [l.id, l.chapter.section.courseId]));

    // Load badges từ DB
    const allUserIds = students.map(s => s.id);
    const badgeRows  = allUserIds.length > 0
      ? await prisma.userBadge.findMany({ where: { userId: { in: allUserIds } } })
      : [];
    const userBadgeMap = new Map<string, string[]>();
    for (const b of badgeRows) {
      if (!userBadgeMap.has(b.userId)) userBadgeMap.set(b.userId, []);
      userBadgeMap.get(b.userId)!.push(b.badgeId);
    }

    const ranked = students.map(s => {
      const enrolledCourseIds = new Set(s.enrollments.map(e => e.courseId));

      // Chỉ đếm lesson progress của khoá ĐANG enroll — tránh sai khi thu hồi khoá
      const completedLessons = s.lessonProgress.filter(lp => {
        const courseId = lessonToCourse.get(lp.lessonId);
        return courseId ? enrolledCourseIds.has(courseId) : false;
      }).length;

      const totalLessons = s.enrollments.reduce((a, e) => a + (e.course.lessons ?? 0), 0);
      const completion   = computeCompletion(completedLessons, totalLessons);

      // "Bài thi tốt nhất" = tỉ lệ điểm/thang điểm cao nhất (không so sánh điểm thô vì các đề có totalPoints khác nhau)
      const bestExam = s.examResults.reduce<typeof s.examResults[number] | undefined>((best, r) => {
        if (r.totalPoints <= 0) return best;
        if (!best || r.score / r.totalPoints > best.score / best.totalPoints) return r;
        return best;
      }, undefined);

      const gpa = computeGpa(completion, bestExam);

      return {
        id:             s.id,
        name:           s.name,
        school:         s.school ?? "—",
        gpa,
        completion,
        strikes:        0,
        monthDelta:     0,
        submissions:    completedLessons,
        submissionRate: completion,
        lastExamScore:  bestExam?.score ?? 0,
        badges:         userBadgeMap.get(s.id) ?? [],
      };
    });

    const result = ranked
      .filter(s => s.completion > 0 || s.lastExamScore > 0)
      .sort((a, b) => b.gpa - a.gpa);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/honor-leaderboard]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
