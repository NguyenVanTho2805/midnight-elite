import { PUBLISHED_ONLY } from "@/lib/lessonStatus";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dropHeldResults } from "@/lib/examHold";
import { computeCompletion, computeGpa, computeAssignmentAverage } from "@/lib/gpa";
import { getSession } from "@/lib/session";
import { makeTtlCache, leaderboardCacheMs } from "@/lib/ttlCache";

// Quyết định của Thọ (04/11/2026, "1B"): bảng vinh danh có tên + trường + GPA + huy hiệu của MỌI học sinh đã ghi danh (nhiều em dưới 16 tuổi) nên BẮT ĐĂNG NHẬP.
// Mọi người đã đăng nhập thấy cùng một nội dung nên đệm chung một bản trong bộ nhớ máy chủ (production 60 giây, dev / bài kiểm tắt); không cho trình duyệt / CDN giữ.
const NO_STORE = { "Cache-Control": "private, no-store" };
const cache = makeTtlCache<unknown[]>(leaderboardCacheMs(), { max: 1 });

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Cần đăng nhập để xem bảng vinh danh" }, { status: 401, headers: NO_STORE });
  const cached = cache.get("all");
  if (cached) return NextResponse.json(cached, { headers: NO_STORE });
  try {
    const students = await prisma.user.findMany({
      where: { role: "student", deletedAt: null, enrollments: { some: {} } },
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
        lessonProgress: { where: { completed: true }, select: { lessonId: true } },
        examResults: {
          select: { score: true, totalPoints: true, examId: true, userId: true },
        },
        assignmentSubmissions: {
          where: { score: { not: null } },
          select: { score: true, assignment: { select: { maxPoints: true } } },
        },
      },
    });

    // Build courseId → Set<lessonId> in ONE query (không N+1)
    const allCourseIds = [...new Set(students.flatMap(s => s.enrollments.map(e => e.courseId)))];
    const courseLessons = allCourseIds.length > 0
      ? await prisma.lesson.findMany({
          where: { ...PUBLISHED_ONLY, chapter: { section: { courseId: { in: allCourseIds } } } },
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

    // Điểm đề đang giữ (tự luận chưa công bố) không vào bảng vinh danh/GPA — cùng hàm examHold với mọi nơi khác.
    const visibleResults = new Set(await dropHeldResults(students.flatMap(s => s.examResults)));

    const ranked = students.map(s0 => {
      const s = { ...s0, examResults: s0.examResults.filter(r => visibleResults.has(r)) };
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

      // Điểm bài tập tự nộp — RIÊNG, không đưa vào computeGpa (xem src/lib/gpa.ts).
      const assignmentAvg = computeAssignmentAverage(
        s.assignmentSubmissions.map(a => ({ score: a.score!, maxPoints: a.assignment.maxPoints }))
      );

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
        assignmentAvg,
        badges:         userBadgeMap.get(s.id) ?? [],
      };
    });

    const result = ranked
      .filter(s => s.completion > 0 || s.lastExamScore > 0)
      .sort((a, b) => b.gpa - a.gpa);

    cache.set("all", result);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/honor-leaderboard]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
