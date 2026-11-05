import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS, splitEnrollmentIds } from "@/lib/enrollment";
import { PUBLISHED_ONLY } from "@/lib/lessonStatus";

// GET /api/enrollments — danh sách courseId mà student hiện tại đã enroll (xếp theo lúc vào lớp, cũ trước, để "lớp đầu tiên" luôn là một lớp xác định).
// `courseIds` = CHỈ lớp đang học (status active). `pendingConsentCourseIds` (2A, 04/11/2026) = lớp em đã vào nhưng đang CHỜ PHỤ HUYNH ĐỒNG Ý: không có quyền học, chỉ để thẻ lớp
// ở /khoa-hoc hiện nhãn "Chờ phụ huynh đồng ý" thay vì nút theo dõi (POST /api/followed-courses từ chối 409 với mọi hồ sơ). Chỉ của CHÍNH người đang đăng nhập; chưa đăng nhập → cả hai rỗng.
// ?detail=1 (NC2-041, danh mục "Lớp của tôi"): thêm `courses` = tên lớp, gia sư, môn, số bài của CHÍNH các lớp em đang học. `courseIds` giữ nguyên.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ courseIds: [], pendingConsentCourseIds: [] });

  const detail = new URL(req.url).searchParams.get("detail") === "1";
  const where = { userId: session.userId, status: { in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING_CONSENT] } };
  const orderBy = [{ createdAt: "asc" as const }, { courseId: "asc" as const }];
  if (!detail) {
    const rows = await prisma.enrollment.findMany({ where, select: { courseId: true, status: true }, orderBy });
    return NextResponse.json(splitEnrollmentIds(rows));
  }

  const all = await prisma.enrollment.findMany({ where, select: { courseId: true, status: true, course: { select: { id: true, name: true, instructor: true, category: true } } }, orderBy });
  const { courseIds, pendingConsentCourseIds } = splitEnrollmentIds(all);
  const rows = all.filter(r => r.status === ENROLLMENT_STATUS.ACTIVE);
  // Số bài tính từ bài học thật của lớp (Course.lessons là số gõ tay, có thể lệch): MỘT truy vấn cho mọi lớp, cộng số bài theo từng chương.
  const sections = courseIds.length === 0 ? [] : await prisma.section.findMany({
    where: { courseId: { in: courseIds } },
    select: { courseId: true, chapters: { select: { _count: { select: { lessons: { where: PUBLISHED_ONLY } } } } } },   // BU-02-PHẲNG (R17): không đếm mục Nháp/Ẩn
  });
  const lessonCount = new Map<string, number>();
  for (const s of sections) lessonCount.set(s.courseId, (lessonCount.get(s.courseId) ?? 0) + s.chapters.reduce((n, c) => n + c._count.lessons, 0));
  const courses = rows.map(r => ({ id: r.course.id, name: r.course.name, instructor: r.course.instructor, category: r.course.category, lessonCount: lessonCount.get(r.courseId) ?? 0 }));
  return NextResponse.json({ courseIds, pendingConsentCourseIds, courses });
}
