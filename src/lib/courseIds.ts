// Mã lớp (Course.id, "slug") làm đường dẫn /lop-cua-toi/<mã> và /khoa-hoc/<mã>. Các trang cố định cùng cấp (/lop-cua-toi/lich, /lop/…)
// luôn thắng đường dẫn động [courseId] — lớp nào đặt mã trùng tên một trang cố định thì trang lớp của nó không bao giờ mở được.
// Danh sách này PHẢI chứa mọi đoạn đường dẫn cố định dưới src/app/lop-cua-toi (test t-course-ids kiểm điều đó trên mã nguồn).
export const RESERVED_COURSE_IDS: readonly string[] = [
  "lich", "lop", "hoc-phi", "doanh-thu", "ho-so", "bai-dang", "cai-dat", "kiem-duyet", "bao-cao-thang", "ke-hoach-buoi", "tong-quan",
];

export const isReservedCourseId = (id: unknown): boolean => typeof id === "string" && RESERVED_COURSE_IDS.includes(id.trim().toLowerCase());
