import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/enrollments — danh sách courseId mà student hiện tại đã enroll (xếp theo lúc vào lớp, cũ trước, để "lớp đầu tiên" luôn là một lớp xác định).
// ?detail=1 (NC2-041, danh mục "Lớp của tôi"): thêm `courses` = tên lớp, gia sư, môn, số bài của CHÍNH các lớp em đã vào. `courseIds` giữ nguyên.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ courseIds: [] });

  const detail = new URL(req.url).searchParams.get("detail") === "1";
  const rows = await prisma.enrollment.findMany({
    where:  { userId: session.userId, status: "active" },
    select: { courseId: true, course: { select: { id: true, name: true, instructor: true, category: true } } },
    orderBy: [{ createdAt: "asc" }, { courseId: "asc" }],
  });
  const courseIds = rows.map(r => r.courseId);
  if (!detail) return NextResponse.json({ courseIds });

  // Số bài tính từ bài học thật của lớp (Course.lessons là số gõ tay, có thể lệch).
  const counts = await Promise.all(courseIds.map(id => prisma.lesson.count({ where: { chapter: { section: { courseId: id } } } })));
  const courses = rows.map((r, i) => ({ id: r.course.id, name: r.course.name, instructor: r.course.instructor, category: r.course.category, lessonCount: counts[i] }));
  return NextResponse.json({ courseIds, courses });
}
