// Rà soát 16/11 (P1): ai NHẬN tin "đề thi mới" / "nhắc thi", và ai được GẮN đề vào một lớp.
// Trước đây: gửi cho MỌI ghi danh có course.category chứa từ đầu của exam.category — không lọc trạng thái, không lọc lớp, không lọc gia sư
// (category rỗng ⇒ cả hệ thống), kèm tên đề ⇒ học sinh lớp của gia sư khác thấy tên đề riêng. Và gia sư gắn được đề của mình vào lớp người khác.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { featureOn } from "@/lib/features";

export type ExamAudienceUser = { id: string; name: string; email: string };
type ExamForAudience = { id: string; courseId: string | null; ownerId: string | null; category: string | null };

/** THUẦN. Cách chọn người nhận: "course" = học sinh đang học đúng lớp của đề; "public" = đề thi thử công khai của KiN (cờ mở) theo môn; "none" = không gửi.
 *  Đề riêng của gia sư không gắn lớp ⇒ "none" (trước đây phát cho mọi lớp cùng môn). */
export function examAudienceKind(i: { courseId: string | null; ownerAdminRole: string | null; category: string | null }, publicOn: boolean): "course" | "public" | "none" {
  if (i.courseId) return "course";
  if (!publicOn || i.ownerAdminRole === "teacher") return "none";
  return (i.category ?? "").trim().split(/\s+/)[0] ? "public" : "none";
}

/** Người nhận + link cho tin đề thi. Chỉ Enrollment "active", tài khoản không khoá / không ẩn danh. */
export async function examAudience(exam: ExamForAudience): Promise<{ users: ExamAudienceUser[]; link: string }> {
  const owner = exam.ownerId ? await prisma.user.findUnique({ where: { id: exam.ownerId }, select: { adminRole: true } }) : null;
  const kind = examAudienceKind({ courseId: exam.courseId, ownerAdminRole: owner?.adminRole ?? null, category: exam.category }, featureOn("THI_THU_CONG_KHAI"));
  if (kind === "none") return { users: [], link: "/student/viec-cua-toi" };
  const live = { status: "active", user: { banned: false, deletedAt: null } } as const;
  const rows = kind === "course"
    ? await prisma.enrollment.findMany({ where: { courseId: exam.courseId!, ...live }, select: { user: { select: { id: true, name: true, email: true } } } })
    : await prisma.enrollment.findMany({ where: { course: { category: { contains: (exam.category ?? "").trim().split(/\s+/)[0] } }, ...live }, select: { user: { select: { id: true, name: true, email: true } } } });
  const seen = new Set<string>();
  const users = rows.map(r => r.user).filter(u => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  return { users, link: kind === "course" ? `/student/thi-thu/${encodeURIComponent(exam.id)}` : "/thi-thu" };
}

/** THUẦN. Gia sư (adminRole teacher) chỉ gắn đề vào lớp mình làm chủ hoặc đang đồng giảng; quản trị trung tâm gắn được mọi lớp. */
export function mayAttachToCourse(i: { adminRole: string | null | undefined; userId: string; courseOwnerId: string | null; activeTeacher: boolean }): boolean {
  if (i.adminRole !== "teacher") return true;
  return i.courseOwnerId === i.userId || i.activeTeacher;
}

/** null = được gắn; ngược lại { status, error }. `courseId` rỗng/null = gỡ khỏi lớp (luôn được). */
export async function attachCourseBlock(auth: SessionPayload, courseId: unknown): Promise<{ status: 400 | 403; error: string } | null> {
  if (courseId === null || courseId === undefined || courseId === "") return null;
  if (typeof courseId !== "string") return { status: 400, error: "Lớp không hợp lệ" };
  const [course, teacher] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } }),
    prisma.courseTeacher.findFirst({ where: { courseId, userId: auth.userId, status: "active" }, select: { id: true } }),
  ]);
  if (!course) return { status: 400, error: "Không tìm thấy lớp" };
  return mayAttachToCourse({ adminRole: auth.adminRole, userId: auth.userId, courseOwnerId: course.ownerId, activeTeacher: !!teacher })
    ? null : { status: 403, error: "Chỉ gắn đề vào lớp cô/thầy đang dạy" };
}
