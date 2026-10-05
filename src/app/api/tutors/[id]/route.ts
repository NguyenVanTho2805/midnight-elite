// FE-116 — GET /api/tutors/[id] — hồ sơ chi tiết gia sư công khai.
//
// Giống /api/tutors nhưng cho 1 gia sư + kèm danh sách lớp đang mở & 1 vài
// stat lớp. 404 nếu id không tồn tại hoặc chưa duyệt (không chênh).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const t = await prisma.user.findFirst({
    where: {
      id,
      role: "admin",
      adminRole: "teacher",
      tutorVerified: true,
      banned: false,
    },
    select: {
      id: true, name: true, avatarBase64: true, bio: true, subjects: true,
      tutorVerified: true, tutorVerifiedAt: true,
    },
  });
  if (!t) return NextResponse.json({ error: "Không tìm thấy gia sư" }, { status: 404 });

  const courses = await prisma.course.findMany({
    where:   { ownerId: id, status: true },
    select:  {
      id: true, name: true, shortTitle: true, category: true, bg: true, strip: true,
      classStatus: true, capacity: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const courseIds = courses.map(c => c.id);

  const [enrollCounts, reviewAggs] = await Promise.all([
    courseIds.length === 0 ? [] : prisma.enrollment.groupBy({
      by:     ["courseId"],
      where:  { courseId: { in: courseIds }, status: ENROLLMENT_STATUS.ACTIVE },
      _count: { _all: true },
    }),
    courseIds.length === 0 ? [] : prisma.courseReview.groupBy({
      by:     ["courseId"],
      where:  { courseId: { in: courseIds }, status: "approved" },
      _avg:   { rating: true },
      _count: { _all: true },
    }),
  ]);

  const activeByCourse = new Map(enrollCounts.map(r => [r.courseId, r._count._all]));
  const reviewByCourse = new Map(reviewAggs.map(r => [r.courseId, { avg: r._avg.rating, total: r._count._all }]));

  const classes = courses.map(c => {
    const activeCount = activeByCourse.get(c.id) ?? 0;
    const r = reviewByCourse.get(c.id);
    return {
      id:          c.id,
      name:        c.name,
      shortTitle:  c.shortTitle,
      category:    c.category,
      bg:          c.bg,
      strip:       c.strip,
      classStatus: c.classStatus,
      capacity:    c.capacity,
      activeCount,
      seatsLeft:   c.capacity === null ? null : Math.max(0, c.capacity - activeCount),
      rating:      r ? { avg: r.avg, total: r.total } : { avg: null, total: 0 },
    };
  });

  // Rating tổng hợp theo gia sư (weighted) — cùng công thức list route.
  let ratingSum = 0, ratingCount = 0;
  for (const r of reviewAggs) {
    if (r._avg.rating == null) continue;
    ratingSum   += r._avg.rating * r._count._all;
    ratingCount += r._count._all;
  }
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : null;

  const studentCount = classes.reduce((s, c) => s + c.activeCount, 0);

  return NextResponse.json({
    tutor: {
      id:              t.id,
      name:            t.name,
      avatarBase64:    t.avatarBase64,
      bio:             t.bio,
      subjects:        t.subjects,
      tutorVerified:   t.tutorVerified,
      tutorVerifiedAt: t.tutorVerifiedAt,
    },
    stats: {
      classCount:   classes.length,
      studentCount,
      rating:       { avg: ratingAvg, total: ratingCount },
    },
    classes,
  });
}
