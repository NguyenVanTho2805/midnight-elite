// FE-109 — GET /api/tutors — danh sách gia sư công khai.
//
// Query:
//   subject — lọc theo môn (so khớp phần tử trong `User.subjects` string[])
//   sort    — "rating" (mặc định, giảm dần) | "students" (số học viên giảm
//              dần) | "classes" (số lớp đang dạy)
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

export type TutorListItem = {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  studentCount: number;
  rating: { avg: number | null; total: number };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject")?.trim() || null;
  const sort    = (searchParams.get("sort") ?? "rating") as "rating" | "students" | "classes";

  const tutors = await prisma.user.findMany({
    where: {
      role: "admin",
      adminRole: "teacher",
      tutorVerified: true,
      banned: false,
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
      rating:        { avg, total: n },
    };
  });

  // Sort client-friendly — không dùng DB vì rating/students đã tính ở memory.
  if (sort === "students") items.sort((a, b) => b.studentCount - a.studentCount);
  else if (sort === "classes") items.sort((a, b) => b.classCount - a.classCount);
  else items.sort((a, b) => (b.rating.avg ?? -1) - (a.rating.avg ?? -1));

  return NextResponse.json({ items });
}
