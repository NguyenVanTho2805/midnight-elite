// MD-03 — ai được thấy LINK học liệu của một bài (video, Zoom, Azota, tài liệu). Phần THUẦN: không đụng cơ sở dữ liệu.
// Quy tắc (một nơi duy nhất, mọi route trả bài học đều gọi vào đây):
//   • quản trị (admin_super, admin_content) → thấy hết;  • gia sư → chỉ lớp CỦA MÌNH (ownerId); lớp người khác hoặc lớp cũ không chủ → khoá
//   • học viên đã ghi danh ĐANG HIỆU LỰC (status = active) → thấy hết      • bài miễn phí (isFree) → ai cũng thấy
//   • còn lại (khách, chưa ghi danh, đã tạm ngưng/chờ đồng ý) → link bị bỏ trống, khung bài vẫn hiện để biết lớp có gì.
import { isEnrollmentActive } from "@/lib/enrollment";

export interface MediaViewer {
  userId: string;
  role: "student" | "admin";
  adminRole?: "admin_super" | "admin_content" | "teacher";
}

export interface MediaContext {
  viewer: MediaViewer | null;
  /** Course.ownerId của lớp chứa bài. */
  courseOwnerId: string | null;
  /** Học viên có Enrollment của lớp này và status = "active"? (admin để false cũng được) */
  enrollment: { status: string } | null | undefined;
}

/** Cột chứa link / nội dung học liệu: bị xoá khỏi bài khi người xem không có quyền. */
export const PROTECTED_LESSON_FIELDS = ["videoUrl", "zoomUrl", "azotaUrl", "documents", "adminNote"] as const;

/** Quản trị toàn quyền hoặc gia sư đúng là chủ lớp. Cùng nghĩa với ownsResource() ở auth-guard nhưng KHÔNG coi không-chủ là của mọi gia sư. */
export function isCourseManager(viewer: MediaViewer | null, courseOwnerId: string | null): boolean {
  if (!viewer || viewer.role !== "admin") return false;
  if (viewer.adminRole === "teacher") return courseOwnerId !== null && courseOwnerId === viewer.userId;
  return true;
}

/** Có quyền xem học liệu của MỌI bài trong lớp (quản lý lớp hoặc học viên đang học). */
export function canViewAllMaterials(ctx: MediaContext): boolean {
  if (isCourseManager(ctx.viewer, ctx.courseOwnerId)) return true;
  if (ctx.viewer?.role === "student" && isEnrollmentActive(ctx.enrollment)) return true;
  return false;
}

export function canViewLessonMaterials(ctx: MediaContext, lesson: { isFree?: boolean | null }): boolean {
  return canViewAllMaterials(ctx) || lesson.isFree === true;
}

/** Bản sao của bài với link bị khoá: chuỗi/ngày giữ nguyên, link → null, tài liệu → mảng rỗng. */
export function redactLesson<L extends object>(lesson: L): L {
  const out: Record<string, unknown> = { ...(lesson as Record<string, unknown>) };
  for (const f of PROTECTED_LESSON_FIELDS) {
    if (!(f in out)) continue;
    out[f] = f === "documents" ? "[]" : null;
  }
  return out as L;
}

/** Trả lại bài đã xử lý theo quyền của người xem. */
export function lessonFor<L extends { isFree?: boolean | null }>(ctx: MediaContext, lesson: L): L {
  return canViewLessonMaterials(ctx, lesson) ? lesson : redactLesson(lesson);
}

type LessonLike = { isFree?: boolean | null };
type CourseTreeLike = { sections: { chapters: { lessons: LessonLike[] }[] }[] };

/** Áp lessonFor cho mọi bài trong cây Phần → Chương → Bài (không sửa đối tượng gốc). */
export function redactCourseTree<C extends CourseTreeLike>(ctx: MediaContext, course: C): C {
  if (canViewAllMaterials(ctx)) return course;
  return {
    ...course,
    sections: course.sections.map(s => ({
      ...s,
      chapters: s.chapters.map(c => ({ ...c, lessons: c.lessons.map(l => lessonFor(ctx, l)) })),
    })),
  } as C;
}

/**
 * Cột của Course chỉ dành cho NGƯỜI TRONG LỚP: hai link nhóm Zalo (`zaloGroupLink` do quản trị đặt ở trang sửa khoá, `zaloGroupUrl` do gia sư gắn ở Cài đặt → Kết nối)
 * và link học online chung của lớp (`classJoinUrl`). Danh sách công khai và chi tiết khoá không được mang chúng cho khách / người ngoài lớp: có link nhóm là vào được nhóm
 * của phụ huynh và học sinh, có link học online là vào được buổi đang dạy. Thêm cột link mới vào Course thì phải quyết định ở đây (t-media-access-lib đối chiếu với schema).
 */
export const PRIVATE_COURSE_FIELDS = ["zaloGroupLink", "zaloGroupUrl", "classJoinUrl"] as const;

/** Bản sao của khoá với các cột riêng tư = null (không sửa đối tượng gốc). Cột không có mặt trong đối tượng thì bỏ qua. */
export function redactCourseLinks<C extends object>(course: C): C {
  const out: Record<string, unknown> = { ...(course as Record<string, unknown>) };
  for (const f of PRIVATE_COURSE_FIELDS) if (f in out) out[f] = null;
  return out as C;
}

/** Khoá trả cho người xem: quản lý lớp / học viên đang học → nguyên bản; người khác → bỏ link riêng tư. Cùng quyền với học liệu (canViewAllMaterials). */
export function courseFor<C extends object>(ctx: MediaContext, course: C): C {
  return canViewAllMaterials(ctx) ? course : redactCourseLinks(course);
}
