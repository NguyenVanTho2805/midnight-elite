// BU-02-PHẲNG — ai thấy mục (Lesson) nào theo TRẠNG THÁI. Dùng chung cho mọi route/hàm đọc của người học: không route nào tự viết lại chuỗi "published".
// Quản lý lớp (QL) = quản trị cấp 1/nội dung, hoặc gia sư là chủ lớp (isCourseManager). Mọi người khác (học sinh, khách, gia sư khác) chỉ thấy "published".
import { isCourseManager } from "./mediaAccess";
import { PUBLISHED_ONLY } from "./lessonStatus";

type SessionLike = { userId: string; role: "student" | "admin"; adminRole?: "admin_super" | "admin_content" | "teacher" } | null | undefined;

/** Phiên có phải quản lý lớp có chủ `ownerId` không. Không phiên ⇒ false. */
export function managerOf(session: SessionLike, ownerId: string | null): boolean {
  if (!session) return false;
  return isCourseManager({ userId: session.userId, role: session.role, adminRole: session.adminRole }, ownerId);
}

/** Mảnh `where` Prisma cho Lesson: QL ⇒ {} (thấy hết), người học ⇒ chỉ published. */
export function learnerLessonWhere(isManager: boolean): { status?: "published" } {
  return isManager ? {} : { ...PUBLISHED_ONLY };
}
