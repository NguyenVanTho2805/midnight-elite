// MD-02 / MD-17 — quyền và đọc dữ liệu Bản ghi của lớp (phần chạm DB). Quy tắc thuần ở classRecordings.ts.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

export type RecordingRole = "manager" | "student";
export type RecordingAccess =
  | { ok: true; role: RecordingRole; course: { id: string; name: string; ownerId: string | null } }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Ai làm gì với bản ghi của một lớp:
 *  - không có lớp → 404; chưa đăng nhập → 401;
 *  - gia sư CHỦ lớp, quản trị cấp 1 / nội dung → "manager" (xem, dán, xoá);
 *  - gia sư lớp khác → 403;
 *  - học sinh ghi danh "active" hoặc "suspended" (như video lưu trên KiN) → "student" (chỉ xem); chưa ghi danh / chờ đồng ý → 403.
 */
export async function recordingAccess(session: SessionPayload | null, courseId: string): Promise<RecordingAccess> {
  if (!session) return { ok: false, status: 401, error: "Chưa đăng nhập" };
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true, ownerId: true } });
  if (!course) return { ok: false, status: 404, error: "Không tìm thấy lớp" };
  if (session.role === "admin") {
    const elevated = session.adminRole === "admin_super" || session.adminRole === "admin_content";
    const owner = session.adminRole === "teacher" && course.ownerId !== null && course.ownerId === session.userId;
    if (elevated || owner) return { ok: true, role: "manager", course };
    return { ok: false, status: 403, error: "Đây không phải lớp của bạn" };
  }
  const enr = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } }, select: { status: true } });
  if (enr && (enr.status === "active" || enr.status === "suspended")) return { ok: true, role: "student", course };
  return { ok: false, status: 403, error: "Bản ghi này dành cho học sinh của lớp" };
}

/** Bản ghi của lớp, kèm buổi (ngày) nếu có. Học sinh nhận cùng dữ liệu (không có tên người tạo). */
export async function listCourseRecordings(courseId: string) {
  const [rows, sessions] = await Promise.all([
    prisma.classRecording.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, title: true, url: true, kind: true, sessionId: true, createdAt: true } }),
    prisma.attendanceSession.findMany({ where: { courseId }, orderBy: { date: "desc" }, take: 120, select: { id: true, date: true } }),
  ]);
  return { rows, sessions: sessions.map(s => ({ id: s.id, dateKey: s.date.toISOString().slice(0, 10) })) };
}
