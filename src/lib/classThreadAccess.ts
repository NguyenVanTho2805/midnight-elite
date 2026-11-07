import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import type { SessionPayload } from "@/lib/session";

// Quyền với thread gắn lớp (Thread.courseId != null) — 1.4.7.
// Members của lớp = học viên Enrollment "active" + GVCN (Course.ownerId) + đồng giảng/giáo viên bộ môn đang hiệu lực (CourseTeacher "active", TUT-dong-giang D7).
// Đồng giảng ĐỌC và ĐĂNG như thành viên; duyệt / xoá / "Chọn là đúng" vẫn của chủ lớp (communityServer.canAcceptReply, MANAGE_COMMUNITY).
// admin_super/admin_content thấy mọi lớp (nhất quán ownsResource).
// Thread "cộng đồng chung" (courseId = null) không qua các hàm này.

function isCenterAdmin(session: SessionPayload | null): boolean {
  return session?.adminRole === "admin_super" || session?.adminRole === "admin_content";
}

// Đồng giảng hiệu lực: dòng CourseTeacher "active" VÀ tài khoản vẫn là gia sư đã duyệt, không khoá, không xoá (đọc lại từ DB, không tin token).
const HELPER_USER_OK = { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, deletedAt: null } as const;

export async function isActiveCourseHelper(userId: string, courseId: string): Promise<boolean> {
  const row = await prisma.courseTeacher.findFirst({
    where: { courseId, userId, status: "active", user: HELPER_USER_OK },
    select: { id: true },
  });
  return !!row;
}

/** Id các lớp người này đang đồng giảng (hiệu lực). */
export async function activeHelperCourseIds(userId: string): Promise<string[]> {
  const rows = await prisma.courseTeacher.findMany({
    where: { userId, status: "active", user: HELPER_USER_OK },
    select: { courseId: true },
  });
  return rows.map(r => r.courseId);
}

export async function canAccessClass(session: SessionPayload | null, courseId: string): Promise<boolean> {
  if (!session) return false;
  if (isCenterAdmin(session)) return true;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!course) return false;
  if (course.ownerId === session.userId) return true;
  if (session.role === "admin" && session.adminRole === "teacher" && (await isActiveCourseHelper(session.userId, courseId))) return true;
  const enrolled = await prisma.enrollment.findUnique({
    where:  { userId_courseId: { userId: session.userId, courseId } },
    select: { status: true, user: { select: { role: true } } },
  });
  // H4: ghi danh cũ của tài khoản đã thành gia sư/quản trị KHÔNG còn là tư cách học viên (vai đọc lại từ DB).
  return enrolled?.status === ENROLLMENT_STATUS.ACTIVE && enrolled.user.role === "student";
}

// Where-clause cho feed mặc định (không lọc lớp cụ thể): cộng đồng chung +
// các lớp người gọi là member. Admin cấp trên → không lọc. Khách → chỉ chung.
export async function visibleThreadScope(
  session: SessionPayload | null,
): Promise<{ OR?: ({ courseId: null } | { courseId: { in: string[] } })[] }> {
  if (isCenterAdmin(session)) return {};
  if (!session) return { OR: [{ courseId: null }] };
  const [owned, enrolled, helping] = await Promise.all([
    prisma.course.findMany({ where: { ownerId: session.userId }, select: { id: true } }),
    prisma.enrollment.findMany({
      where:  { userId: session.userId, status: ENROLLMENT_STATUS.ACTIVE, user: { role: "student" } },
      select: { courseId: true },
    }),
    session.role === "admin" && session.adminRole === "teacher" ? activeHelperCourseIds(session.userId) : Promise.resolve([] as string[]),
  ]);
  const ids = [...owned.map(c => c.id), ...enrolled.map(e => e.courseId), ...helping];
  return { OR: [{ courseId: null }, { courseId: { in: ids } }] };
}

// Dùng ở các route thao tác 1 thread (xem, trả lời, thích, lưu, báo cáo):
// true nếu thread là cộng đồng chung hoặc người gọi là member của lớp.
export async function canAccessThread(
  session: SessionPayload | null,
  thread: { courseId: string | null },
): Promise<boolean> {
  if (!thread.courseId) return true;
  return canAccessClass(session, thread.courseId);
}
