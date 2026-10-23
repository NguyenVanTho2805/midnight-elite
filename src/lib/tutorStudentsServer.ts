// Danh sách học sinh của gia sư (Figma "Gia sư · Học sinh" 299:113083). CHỈ học sinh ghi danh vào lớp do chính gia sư này làm chủ (Course.ownerId).
// Trường trả ra đúng bằng trang danh sách học sinh của lớp (/api/courses/[id]/students): tên, email, SĐT, trường, ngày ghi danh — không thêm trường mới.
// Chỉ lấy ghi danh "active" (đang học) và "suspended" (đã nghỉ); "pending_consent" (chờ phụ huynh xác nhận) không hiện ở đây, việc đó nằm ở Hộp việc.
import { prisma } from "@/lib/prisma";

export interface TutorStudentRow {
  key: string; // userId:courseId
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  courseId: string;
  courseName: string;
  enrolledAt: string;
  status: "active" | "suspended";
}

export async function loadTutorStudents(tutorId: string): Promise<TutorStudentRow[]> {
  const rows = await prisma.enrollment.findMany({
    where: { status: { in: ["active", "suspended"] }, course: { ownerId: tutorId } },
    select: {
      userId: true, courseId: true, createdAt: true, status: true,
      user: { select: { name: true, email: true, phone: true, school: true } },
      course: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({
    key: `${r.userId}:${r.courseId}`,
    userId: r.userId, name: r.user.name, email: r.user.email, phone: r.user.phone, school: r.user.school,
    courseId: r.courseId, courseName: r.course.name, enrolledAt: r.createdAt.toISOString(),
    status: r.status === "suspended" ? "suspended" : "active",
  }));
}
