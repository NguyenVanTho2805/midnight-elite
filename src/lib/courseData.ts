// Danh mục chuẩn + màu theo danh mục — dùng chung admin/guest/student.
// Trước 14/10/2026 file này còn chứa danh sách "khoá học mẫu" (tên giáo viên, giá, số bài học bịa) và hashtag theo mã khoá mẫu;
// không nơi nào dùng nên đã xoá. Khoá học thật luôn lấy từ cơ sở dữ liệu (/api/courses).

/** Danh mục chuẩn — dùng chung toàn hệ thống */
export const COURSE_CATEGORIES = [
  "Tất cả",
  "ĐGNL HSA",
  "ĐGNL HCM",
  "Tốt nghiệp THPT",
  "TSA Bách Khoa",
  "BCA",
] as const;

export type CourseCategory = typeof COURSE_CATEGORIES[number];

/** Admin filter — không có "Tất cả" */
export const ADMIN_CATEGORIES = COURSE_CATEGORIES.slice(1) as readonly string[];

/** Gradient màu theo danh mục — dùng chung admin/guest/student */
export const CATEGORY_GRADIENT: Record<string, string> = {
  "ĐGNL HSA":        "linear-gradient(135deg,#0042AA,#0068FF,#38BDF8)",
  "Tốt nghiệp THPT": "linear-gradient(135deg,#15803D,#16a34a,#4ADE80)",
  "ĐGNL HCM":        "linear-gradient(135deg,#6D28D9,#8B5CF6,#C4B5FD)",
  "TSA Bách Khoa":   "linear-gradient(135deg,#C2410C,#EA580C,#FB923C)",
  "BCA":             "linear-gradient(135deg,#1E2938,#374151,#6B7280)",
};
