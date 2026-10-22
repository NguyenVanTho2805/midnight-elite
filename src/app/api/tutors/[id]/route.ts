// FE-116 — GET /api/tutors/[id] — hồ sơ chi tiết gia sư công khai.
//
// Giống /api/tutors nhưng cho 1 gia sư + kèm danh sách lớp đang mở & 1 vài
// stat lớp. 404 nếu id không tồn tại hoặc chưa duyệt (không chênh).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { readPreferences } from "@/lib/userPreferences";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { taughtSessionWhere } from "@/lib/taughtSessions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const t = await prisma.user.findFirst({
    where: {
      id,
      role: "admin",
      adminRole: "teacher",
      tutorVerified: true,
      banned: false,
      profileLockedAt: null, // PH-212: hồ sơ bị khoá thì như không tồn tại với người ngoài
    },
    select: {
      id: true, name: true, avatarBase64: true, bio: true, subjects: true,
      tutorVerified: true, tutorVerifiedAt: true, phone: true, preferences: true,
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

  const [enrollCounts, reviewAggs, sessionsTaught] = await Promise.all([
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
    // PH-207 + ĐX-00: số buổi đã dạy lấy từ sổ lớp — chỉ phiên có ngày ≤ hôm nay (giờ VN) và ít nhất 1 em có mặt/muộn
    // (src/lib/taughtSessions.ts). Đây là số gia sư tự ghi khi điểm danh, không phải bằng chứng đã xác minh.
    courseIds.length === 0 ? 0 : prisma.attendanceSession.count({ where: { courseId: { in: courseIds }, ...taughtSessionWhere() } }),
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
      // PH-215: số Zalo chỉ lộ khi gia sư BẬT "Hiện số Zalo trên hồ sơ" (tắt sẵn vì zalo.me/<số> để lộ số).
      zalo: readPreferences(t.preferences).connections?.showZalo ? normalizeZaloPhone(t.phone) : null,
      // PH-215: trang Messenger do gia sư chủ động nhập → hiện nút "Nhắn Messenger" (tin điền sẵn qua m.me/<tên>?text=).
      messenger: readPreferences(t.preferences).connections?.messenger ?? null,
    },
    stats: {
      classCount:   classes.length,
      studentCount,
      sessionsTaught,
      rating:       { avg: ratingAvg, total: ratingCount },
    },
    classes,
  });
}
