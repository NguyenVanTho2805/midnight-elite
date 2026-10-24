// Che nội dung bài học khỏi người chưa có quyền xem, và quyết định ai được xem video lưu trên KiN. THUẦN, test được không cần DB.
//
// Lỗi gốc (HIEN-CO-VA-DINH-VI.md mục 6.4): GET /api/courses/[id] và /api/lessons/[id]/context chỉ đổi cờ isLocked cho khách,
// còn videoUrl, documents, azotaUrl, zoomUrl, adminNote của MỌI bài (kể cả bài trả phí) vẫn nằm trong JSON trả về.

/** Mọi trường mang nội dung học liệu của một bài: khách / người chưa vào lớp không bao giờ được nhận các trường này của bài trả phí. */
export const LESSON_CONTENT_FIELDS = ["videoUrl", "zoomUrl", "azotaUrl", "azotaDeadline", "documents", "adminNote"] as const;

type Lessonish = { isFree?: boolean | null } & Record<string, unknown>;

/** Bản đã che của một bài: các trường nội dung về rỗng (documents = "[]" để chỗ đọc JSON không hỏng). Không sửa bản gốc. */
export function redactLesson<T extends Lessonish>(l: T): T {
  const out: Record<string, unknown> = { ...l };
  for (const k of LESSON_CONTENT_FIELDS) if (k in out) out[k] = k === "documents" ? "[]" : null;
  return out as T;
}

type Tree = { sections: { chapters: { lessons: Lessonish[] }[] }[] };

/** Che nội dung mọi bài KHÔNG miễn phí khi `canSeeAll` = false. Bài miễn phí luôn giữ nguyên (cho xem thử). */
export function redactCourseTree<T extends Tree>(course: T, canSeeAll: boolean): T {
  if (canSeeAll) return course;
  return {
    ...course,
    sections: course.sections.map(s => ({
      ...s,
      chapters: s.chapters.map(c => ({ ...c, lessons: c.lessons.map(l => (l.isFree ? l : redactLesson(l))) })),
    })),
  };
}

export interface MediaViewer {
  userId: string;
  role: "admin" | "student" | string;
  adminRole?: string | null;
  /** Course.ownerId của lớp chứa bài. */
  courseOwnerId: string | null;
  /** Trạng thái ghi danh của người xem trong lớp đó, null nếu chưa ghi danh. */
  enrollmentStatus: string | null;
  lessonIsFree: boolean;
}

/**
 * Ai được xem một video lưu trên KiN.
 *  - quản trị cấp 1 / quản trị nội dung: xem được;
 *  - gia sư: chỉ lớp của chính mình;
 *  - học viên: ghi danh "active", hoặc "suspended" (xem lại nội dung đã mở, như /context), hoặc bài miễn phí.
 *  "pending_consent" (chưa có đồng ý của phụ huynh) không tính là đã ghi danh: chỉ xem được bài miễn phí, như mọi người chưa vào lớp.
 */
export function canWatchStoredMedia(v: MediaViewer): boolean {
  if (v.role === "admin") {
    if (v.adminRole === "admin_super" || v.adminRole === "admin_content") return true;
    return v.adminRole === "teacher" && v.courseOwnerId !== null && v.courseOwnerId === v.userId;
  }
  if (v.enrollmentStatus === "active" || v.enrollmentStatus === "suspended") return true;
  return v.lessonIsFree;
}
