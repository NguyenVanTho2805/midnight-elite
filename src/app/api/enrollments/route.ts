import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/enrollments — danh sách courseId mà student hiện tại đã enroll (xếp theo lúc vào lớp, cũ trước, để "lớp đầu tiên" luôn là một lớp xác định).
// ?detail=1 (NC2-041, danh mục "Lớp của tôi"): thêm `courses` = tên lớp, gia sư, môn, số bài của CHÍNH các lớp em đã vào. `courseIds` giữ nguyên.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ courseIds: [] });

  const detail = new URL(req.url).searchParams.get("detail") === "1";
  const where = { userId: session.userId, status: "active" };
  const orderBy = [{ createdAt: "asc" as const }, { courseId: "asc" as const }];
  if (!detail) {
    const rows = await prisma.enrollment.findMany({ where, select: { courseId: true }, orderBy });
    return NextResponse.json({ courseIds: rows.map(r => r.courseId) });
  }

  const rows = await prisma.enrollment.findMany({ where, select: { courseId: true, course: { select: { id: true, name: true, instructor: true, category: true } } }, orderBy });
  const courseIds = rows.map(r => r.courseId);
  // Số bài tính từ bài học thật của lớp (Course.lessons là số gõ tay, có thể lệch): MỘT truy vấn cho mọi lớp, cộng số bài theo từng chương.
  const sections = courseIds.length === 0 ? [] : await prisma.section.findMany({
    where: { courseId: { in: courseIds } },
    select: { courseId: true, chapters: { select: { _count: { select: { lessons: true } } } } },
  });
  const lessonCount = new Map<string, number>();
  for (const s of sections) lessonCount.set(s.courseId, (lessonCount.get(s.courseId) ?? 0) + s.chapters.reduce((n, c) => n + c._count.lessons, 0));
  const courses = rows.map(r => ({ id: r.course.id, name: r.course.name, instructor: r.course.instructor, category: r.course.category, lessonCount: lessonCount.get(r.courseId) ?? 0 }));
  return NextResponse.json({ courseIds, courses });
}
