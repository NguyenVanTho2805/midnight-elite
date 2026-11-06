// BU-02-PHẲNG — trạng thái từng mục giáo trình (Lesson.status): PHẦN THUẦN (không React, không DB).
// Quy tắc sống còn: ĐÓNG KHI LẠ. Chỉ đúng chuỗi "published" mới tới học sinh/khách; mọi giá trị khác (null, rỗng, sai hoa/thường, chưa biết) là KHÔNG thấy.
export const LESSON_STATUSES = ["draft", "published", "hidden"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const isLessonStatus = (v: unknown): v is LessonStatus => typeof v === "string" && (LESSON_STATUSES as readonly string[]).includes(v);

/** ĐÓNG KHI LẠ: chỉ đúng chuỗi "published" mới là học sinh/khách thấy được. null, "", "Published", giá trị chưa biết ⇒ false. */
export const isLearnerVisible = (status: unknown): boolean => status === "published";

/** Mảnh `where` Prisma dùng ở mọi truy vấn của người học. */
export const PUBLISHED_ONLY = { status: "published" } as const;

/** Bảng chuyển trạng thái (mục 6.1): đúng 4 ô hợp lệ; chuyển về chính nó KHÔNG hợp lệ (G4 tự xử lý idempotent trước khi gọi hàm này). */
export function canTransition(from: LessonStatus, to: LessonStatus): boolean {
  return (from === "draft" && to === "published") || (from === "published" && to === "hidden") || (from === "hidden" && to === "published") || (from === "hidden" && to === "draft");
}

/** Câu tiếng Việt giải thích vì sao chưa chuyển được; null nếu hợp lệ. Dùng chung G4/G5. */
export function transitionError(from: LessonStatus, to: LessonStatus): string | null {
  if (canTransition(from, to)) return null;
  if (from === "draft" && to === "hidden") return "Mục Nháp chưa từng đăng, không cần ẩn.";
  if (from === "published" && to === "draft") return "Mục đã đăng không đưa về Nháp được. Hãy dùng Ẩn.";
  return "Không chuyển được trạng thái này.";
}

/** null = đăng được. Mục không có nội dung dùng được (mọi mục hỏng) và không có Bài tập tự nộp ⇒ chặn. Có nội dung nhưng một phần hỏng ⇒ vẫn đăng được. */
export function publishBlockFor(entry: { items: { broken: boolean }[]; selfSubmitCount: number }): string | null {
  const usable = entry.items.some(i => !i.broken);
  if (usable || entry.selfSubmitCount > 0) return null;
  return "Mục chưa có nội dung. Thêm link hoặc tệp rồi đăng.";
}

type Tree = { sections: { chapters: { lessons: { status: unknown }[] }[] }[] };

/**
 * Bản sao cây với chỉ bài published. Chương/phần không còn bài Đã đăng nào thì bỏ (không lộ tên chương chỉ có bài nháp hoặc chương vừa tạo còn trống). Người quản lý lớp ⇒ trả nguyên (cùng đối tượng). Không đổi đối tượng gốc.
 */
export function pruneTreeForViewer<T extends Tree>(tree: T, isManager: boolean): T {
  if (isManager) return tree;
  const sections = tree.sections.flatMap(sec => {
    const chapters = sec.chapters.flatMap(ch => {
      const lessons = ch.lessons.filter(l => isLearnerVisible(l.status));
      if (lessons.length === 0) return [];   // chương chưa có bài Đã đăng (kể cả chương trống vừa tạo) không lộ tên cho người học
      return [{ ...ch, lessons }];
    });
    if (chapters.length === 0) return [];
    return [{ ...sec, chapters }];
  });
  return { ...tree, sections } as T;
}
