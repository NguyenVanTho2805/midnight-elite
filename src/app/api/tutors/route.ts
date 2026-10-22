// FE-109 — GET /api/tutors — danh sách gia sư công khai.
//
// Query:
//   subject — lọc theo môn (so khớp phần tử trong `User.subjects` string[])
//   sort    — "active" (mặc định: gia sư có dạy trong 30 ngày qua lên trước, ĐX-05) | "rating" (đánh giá giảm dần) |
//              "students" (số học viên giảm dần) | "classes" (số lớp đang dạy). Giá trị lạ → mặc định.
//
// Chỉ trả gia sư đã duyệt: `role = "admin" AND adminRole = "teacher" AND
// tutorVerified = true`. Người đang chờ duyệt KHÔNG hiện ở public.
//
// Rating theo D08 (chốt): CourseReview ghi theo lớp, hiển thị tổng hợp
// theo gia sư — aggregate theo `Course.ownerId`. Chỉ tính review
// `status = "approved"`.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { parseTutorSort, recentTaughtSessionWhere, sortTutors } from "@/lib/tutorActivity";

export type TutorListItem = {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  studentCount: number;
  /** ĐX-00: buổi ĐÃ DẠY theo sổ lớp (cùng số với hồ sơ chi tiết). Gia sư tự ghi, không phải bằng chứng đã xác minh. */
  sessionsTaught: number;
  /** ĐX-05: có ít nhất 1 buổi đã dạy trong 30 ngày qua. */
  recentlyActive: boolean;
  rating: { avg: number | null; total: number };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject")?.trim() || null;
  const sort    = parseTutorSort(searchParams.get("sort"));

  const tutors = await prisma.user.findMany({
    where: {
      role: "admin",
      adminRole: "teacher",
      tutorVerified: true,
      banned: false,
      profileLockedAt: null, // PH-212
      ...(subject ? { subjects: { has: subject } } : {}),
    },
    select: {
      id: true, name: true, avatarBase64: true, bio: true, subjects: true, tutorVerified: true,
    },
  });

  if (tutors.length === 0) return NextResponse.json({ items: [] });

  const ids = tutors.map(t => t.id);

  // 1 round-trip cho mỗi aggregate — số gia sư trên public thường rất nhỏ
  // (<< 1000) nên không cần tối ưu thêm; không join subquery vì Prisma 7
  // chưa hỗ trợ gọn.
  const [classRows, enrollRows, reviewRows] = await Promise.all([
    prisma.course.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.enrollment.groupBy({
      by: ["courseId"],
      where: { status: ENROLLMENT_STATUS.ACTIVE, course: { ownerId: { in: ids } } },
      _count: { _all: true },
    }),
    prisma.courseReview.groupBy({
      by: ["courseId"],
      where: { status: "approved", course: { ownerId: { in: ids } } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  // Map courseId → ownerId để quy đổi aggregate theo course về theo tutor.
  const courseOwner = new Map<string, string>();
  const courses = await prisma.course.findMany({
    where:  { ownerId: { in: ids } },
    select: { id: true, ownerId: true },
  });
  for (const c of courses) if (c.ownerId) courseOwner.set(c.id, c.ownerId);

  // ĐX-05: số buổi đã dạy và "có dạy trong 30 ngày qua" của từng gia sư. Chỉ tính lớp đang bật (status = true) như hồ sơ chi tiết
  // (api/tutors/[id]) để số trên thẻ và số trên hồ sơ không bao giờ lệch nhau.
  const ownedLive = { ownerId: { in: ids }, status: true };
  const [taughtRows, recentRows] = await Promise.all([
    prisma.attendanceSession.groupBy({ by: ["courseId"], where: { course: ownedLive, ...taughtSessionWhere() }, _count: { _all: true } }),
    prisma.attendanceSession.findMany({ where: { course: ownedLive, ...recentTaughtSessionWhere() }, select: { courseId: true }, distinct: ["courseId"] }),
  ]);
  const sessionsTaught = new Map<string, number>();
  for (const r of taughtRows) { const o = courseOwner.get(r.courseId); if (o) sessionsTaught.set(o, (sessionsTaught.get(o) ?? 0) + r._count._all); }
  const recentOwners = new Set<string>();
  for (const r of recentRows) { const o = courseOwner.get(r.courseId); if (o) recentOwners.add(o); }

  const classCount = new Map<string, number>();
  for (const r of classRows) if (r.ownerId) classCount.set(r.ownerId, r._count._all);

  const studentCount = new Map<string, number>();
  for (const r of enrollRows) {
    const owner = courseOwner.get(r.courseId);
    if (!owner) continue;
    studentCount.set(owner, (studentCount.get(owner) ?? 0) + r._count._all);
  }

  // Rating trung bình THEO GIA SƯ: trung bình các _avg từng lớp, có trọng
  // số theo số review (không dùng trung bình đơn thuần của các avg vì lớp
  // ít review sẽ cân bằng không công bằng).
  const ratingSum   = new Map<string, number>();  // tổng rating thực
  const ratingCount = new Map<string, number>();
  for (const r of reviewRows) {
    const owner = courseOwner.get(r.courseId);
    if (!owner || r._avg.rating == null) continue;
    ratingSum.set(owner, (ratingSum.get(owner) ?? 0) + r._avg.rating * r._count._all);
    ratingCount.set(owner, (ratingCount.get(owner) ?? 0) + r._count._all);
  }

  const items: TutorListItem[] = tutors.map(t => {
    const n = ratingCount.get(t.id) ?? 0;
    const avg = n > 0 ? (ratingSum.get(t.id) ?? 0) / n : null;
    return {
      id:            t.id,
      name:          t.name,
      avatarBase64:  t.avatarBase64,
      bio:           t.bio,
      subjects:      t.subjects,
      tutorVerified: t.tutorVerified,
      classCount:    classCount.get(t.id) ?? 0,
      studentCount:  studentCount.get(t.id) ?? 0,
      sessionsTaught: sessionsTaught.get(t.id) ?? 0,
      recentlyActive: recentOwners.has(t.id),
      rating:        { avg, total: n },
    };
  });

  // Thứ tự xác định (hoà thì theo tên) và nằm ở hàm thuần có test: src/lib/tutorActivity.ts.
  return NextResponse.json({ items: sortTutors(items, sort) });
}
