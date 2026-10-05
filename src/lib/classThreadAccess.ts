import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import type { SessionPayload } from "@/lib/session";

// Quyền với thread gắn lớp (Thread.courseId != null) — 1.4.7.
// Members của lớp = học viên Enrollment "active" + GVCN (Course.ownerId).
// admin_super/admin_content thấy mọi lớp (nhất quán ownsResource).
// Thread "cộng đồng chung" (courseId = null) không qua các hàm này.

function isCenterAdmin(session: SessionPayload | null): boolean {
  return session?.adminRole === "admin_super" || session?.adminRole === "admin_content";
}

export async function canAccessClass(session: SessionPayload | null, courseId: string): Promise<boolean> {
  if (!session) return false;
  if (isCenterAdmin(session)) return true;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!course) return false;
  if (course.ownerId === session.userId) return true;
  const enrolled = await prisma.enrollment.findUnique({
    where:  { userId_courseId: { userId: session.userId, courseId } },
    select: { status: true },
  });
  return enrolled?.status === ENROLLMENT_STATUS.ACTIVE;
}

// Where-clause cho feed mặc định (không lọc lớp cụ thể): cộng đồng chung +
// các lớp người gọi là member. Admin cấp trên → không lọc. Khách → chỉ chung.
export async function visibleThreadScope(
  session: SessionPayload | null,
): Promise<{ OR?: ({ courseId: null } | { courseId: { in: string[] } })[] }> {
  if (isCenterAdmin(session)) return {};
  if (!session) return { OR: [{ courseId: null }] };
  const [owned, enrolled] = await Promise.all([
    prisma.course.findMany({ where: { ownerId: session.userId }, select: { id: true } }),
    prisma.enrollment.findMany({
      where:  { userId: session.userId, status: ENROLLMENT_STATUS.ACTIVE },
      select: { courseId: true },
    }),
  ]);
  const ids = [...owned.map(c => c.id), ...enrolled.map(e => e.courseId)];
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
