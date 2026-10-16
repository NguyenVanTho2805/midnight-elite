// Ai được thấy NỘI DUNG của một bài học (đường dẫn video, buổi học trực tuyến, link Azota, tài liệu, ghi chú) — chỗ duy nhất quyết định,
// để các API trả bài học (khoá học, bài giảng, bài tập) không mỗi nơi hiểu một kiểu.
//
// Bối cảnh (16/10/2026): GET /api/courses/[id] và GET /api/lessons/[id]/context trả nguyên bản ghi Lesson cho cả khách chưa đăng nhập / học viên chưa ghi danh,
// chỉ đặt lại cờ isLocked — "khoá" chỉ là cờ giao diện, ai mở DevTools cũng lấy được videoUrl / documents của bài trả phí.
// Quy tắc: bài `isFree` (học thử) công khai; mọi bài khác chỉ lộ nội dung cho người có TOÀN QUYỀN với lớp đó (xem canViewCourseContent).
// Không tin cờ isLocked trong DB để quyết định cắt nội dung: quên đặt isLocked = true từng làm lộ bài trả phí (xem chú thích ở /context).
import { ENROLLMENT_STATUS } from "@/lib/enrollment";

/** Các cột nội dung của Lesson — chỉ người có toàn quyền với lớp mới được thấy (trừ bài học thử miễn phí). */
export const LESSON_CONTENT_FIELDS = ["videoUrl", "zoomUrl", "azotaUrl", "azotaDeadline", "documents", "adminNote"] as const;

export interface ViewerSession {
  userId: string;
  role: "student" | "admin";
  adminRole?: "admin_super" | "admin_content" | "teacher";
}

/**
 * Toàn quyền với nội dung MỌI bài của một lớp:
 *  - quản trị cấp 1 / quản trị nội dung: luôn;
 *  - gia sư: chỉ lớp của chính mình (ownerId === userId; lớp cũ ownerId = null thì không) — cùng quy tắc ownsResource ở src/lib/auth-guard.ts;
 *  - học viên: ghi danh "active" (và "suspended" khi `includeSuspended`: chỉ xem lại nội dung đã mở, xem /api/lessons/[id]/context);
 *  - khách / người khác: không.
 */
export function canViewCourseContent(
  viewer: ViewerSession | null | undefined,
  course: { ownerId: string | null },
  enrollment: { status: string } | null | undefined,
  opts: { includeSuspended?: boolean } = {},
): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return viewer.adminRole !== "teacher" || course.ownerId === viewer.userId;
  if (!enrollment) return false;
  if (enrollment.status === ENROLLMENT_STATUS.ACTIVE) return true;
  return !!opts.includeSuspended && enrollment.status === ENROLLMENT_STATUS.SUSPENDED;
}

type LessonLike = { isFree: boolean; isLocked: boolean };

/** Bài học dưới con mắt của người KHÔNG có toàn quyền: bài không miễn phí bị cắt nội dung và luôn hiện khoá; bài học thử giữ nguyên. */
export function redactLessonForOutsider<T extends LessonLike>(lesson: T): T {
  if (lesson.isFree) return lesson;
  const out: Record<string, unknown> = { ...lesson, isLocked: true };
  for (const f of LESSON_CONTENT_FIELDS) out[f] = f === "documents" ? "[]" : null;
  return out as T;
}

/** Bài học trả cho người xem: toàn quyền → mở khoá hết (bất kể cờ DB); ngược lại → cắt nội dung bài trả phí. */
export function lessonForViewer<T extends LessonLike>(lesson: T, fullAccess: boolean): T {
  return fullAccess ? { ...lesson, isLocked: false } : redactLessonForOutsider(lesson);
}

type TreeLike<L> = { sections: Array<{ chapters: Array<{ lessons: L[] }> }> };

/** Áp lessonForViewer cho cả cây khoá → phần → chương → bài (không sửa đối tượng gốc). */
export function courseTreeForViewer<L extends LessonLike, C extends TreeLike<L>>(course: C, fullAccess: boolean): C {
  return {
    ...course,
    sections: course.sections.map(s => ({
      ...s,
      chapters: s.chapters.map(c => ({ ...c, lessons: c.lessons.map(l => lessonForViewer(l, fullAccess)) })),
    })),
  };
}
