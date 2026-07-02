import type { MasterCourse, AdminCourse, CatalogCourse } from "./types";

// ─── MASTER COURSE LIST ────────────────────────────────────────────────────────
// Single source of truth. Mọi role đều import từ đây.
// Thêm/sửa khóa học → chỉ sửa file này, tất cả role tự cập nhật.

export const COURSES: MasterCourse[] = [
  {
    id:           "hsa-tron-goi",
    adminId:      15,
    adminName:    "HSA Premium 2K9 — Toàn diện luyện thi ĐGNL HSA 2026",
    name:         "ĐGNL HSA — Trọn gói lộ trình",
    shortTitle:   "TRỌN GÓI\nĐGNL HSA",
    category:     "ĐGNL HSA",
    instructor:   "Thầy Đỗ Đức",
    teacherAvatar:"Đ",
    openDate:     "15/06/2026",
    types:        ["Video", "Live"],
    tag:          "HOT",
    tagColor:     "#FF2157",
    bg:           "linear-gradient(135deg,#0042AA 0%,#0068FF 60%,#38BDF8 100%)",
    strip:        "#FDE047",
    price:        2990000,
    originalPrice:4990000,
    lessons:      96,
    hours:        120,
    status:       true,
    createdAt:    "01/01/2026 08:00:00",
  },
  {
    id:           "toan-12",
    adminId:      12,
    adminName:    "ĐGNL HSA Trọn gói — Tư duy Định lượng + Định tính + KHTN + KHXH",
    name:         "Toán học lớp 12",
    shortTitle:   "TOÁN HỌC\nLỚP 12",
    category:     "Tốt nghiệp THPT",
    instructor:   "Thầy Nguyễn Minh",
    teacherAvatar:"M",
    openDate:     "10/06/2026",
    types:        ["Video", "Live"],
    bg:           "linear-gradient(135deg,#15803D 0%,#16a34a 60%,#4ADE80 100%)",
    strip:        "#FDE047",
    price:        990000,
    originalPrice:1490000,
    lessons:      38,
    hours:        75,
    status:       true,
    createdAt:    "15/01/2026 10:30:00",
  },
  {
    id:           "combo-8-mon",
    adminId:      18,
    adminName:    "Combo THPT 8 môn — Tốt nghiệp 2026 Trọn gói",
    name:         "Combo 8 môn Tốt nghiệp THPT",
    shortTitle:   "COMBO\n8 MÔN THPT",
    category:     "Tốt nghiệp THPT",
    instructor:   "Nhiều GV",
    teacherAvatar:"★",
    openDate:     "01/07/2026",
    types:        ["Video", "Live"],
    tag:          "SALE",
    tagColor:     "#FE9900",
    bg:           "linear-gradient(135deg,#5B21B6 0%,#7C3AED 60%,#C4B5FD 100%)",
    strip:        "#FDE047",
    price:        3490000,
    originalPrice:5990000,
    lessons:      280,
    hours:        320,
    status:       true,
    createdAt:    "20/01/2026 09:15:00",
  },
  {
    id:           "hsa-toan",
    adminId:      29,
    adminName:    "2K7. XUẤT PHÁT SỚM — Khóa học ôn thi ĐGNL HSA 2025",
    name:         "Toán ĐGNL HSA — Chuyên sâu",
    shortTitle:   "TOÁN\nĐGNL HSA",
    category:     "ĐGNL HSA",
    instructor:   "Thầy Đỗ Đức",
    teacherAvatar:"Đ",
    openDate:     "20/06/2026",
    types:        ["Video"],
    bg:           "linear-gradient(135deg,#0042AA 0%,#0068FF 60%,#38BDF8 100%)",
    strip:        "#FDE047",
    price:        890000,
    lessons:      36,
    hours:        45,
    status:       false,
    createdAt:    "19/02/2025 00:48:35",
  },
  {
    id:           "hsa-van",
    adminId:      8,
    adminName:    "Thực chiến phòng thi — Chiến lược làm bài thi ĐGNL đạt điểm cao",
    name:         "Ngữ văn ĐGNL HSA — Tư duy định tính",
    shortTitle:   "NGỮ VĂN\nĐGNL HSA",
    category:     "ĐGNL HSA",
    instructor:   "Cô Trần Linh",
    teacherAvatar:"L",
    openDate:     "20/06/2026",
    types:        ["Video", "Live"],
    bg:           "linear-gradient(135deg,#0042AA 0%,#0068FF 60%,#38BDF8 100%)",
    strip:        "#FDE047",
    price:        890000,
    lessons:      28,
    hours:        35,
    status:       true,
    createdAt:    "08/12/2024 00:30:14",
  },
  {
    id:           "hcm-tron-goi",
    adminId:      34,
    adminName:    "VACT01.2K8 KHÓA XUẤT PHÁT SỚM ĐÁNH GIÁ NĂNG LỰC ĐHQG HCM",
    name:         "ĐGNL HCM — Trọn gói lộ trình",
    shortTitle:   "TRỌN GÓI\nĐGNL HCM",
    category:     "ĐGNL HCM",
    instructor:   "Thầy Phạm Hùng",
    teacherAvatar:"H",
    openDate:     "05/07/2026",
    types:        ["Video", "Live"],
    tag:          "MỚI",
    tagColor:     "#0068FF",
    bg:           "linear-gradient(135deg,#6D28D9 0%,#8B5CF6 60%,#C4B5FD 100%)",
    strip:        "#FDE047",
    price:        2490000,
    originalPrice:3990000,
    lessons:      84,
    hours:        100,
    status:       true,
    createdAt:    "05/03/2025 22:31:30",
  },
  {
    id:           "tsa-bach-khoa",
    adminId:      23,
    adminName:    "2K8.TSA.BK01 - XPS ĐÁNH GIÁ TƯ DUY ĐẠI HỌC BÁCH KHOA HÀ NỘI - TSA 2026",
    name:         "TSA Bách Khoa — Luyện đề thực chiến",
    shortTitle:   "TRỌN GÓI\nTSA BK",
    category:     "TSA Bách Khoa",
    instructor:   "Thầy Lê Văn An",
    teacherAvatar:"A",
    openDate:     "15/07/2026",
    types:        ["Video", "Live"],
    bg:           "linear-gradient(135deg,#C2410C 0%,#EA580C 60%,#FB923C 100%)",
    strip:        "#FDE047",
    price:        2190000,
    originalPrice:3290000,
    lessons:      72,
    hours:        90,
    status:       false,
    createdAt:    "10/02/2025 07:07:55",
  },
  {
    id:           "bca-2k8",
    adminId:      21,
    adminName:    "BCA 2K8 — Đánh giá tuyển sinh Bộ Công An 2026",
    name:         "BCA 2K8 — Đánh giá tuyển sinh Bộ Công An",
    shortTitle:   "TRỌN GÓI\nBCA 2K8",
    category:     "BCA",
    instructor:   "Midnight Elite",
    teacherAvatar:"B",
    openDate:     "01/08/2026",
    types:        ["Video"],
    bg:           "linear-gradient(135deg,#1E2938 0%,#374151 60%,#6B7280 100%)",
    strip:        "#FDE047",
    price:        1890000,
    originalPrice:2490000,
    lessons:      60,
    hours:        80,
    status:       false,
    createdAt:    "25/01/2026 14:00:00",
  },
];

// ─── ID của khóa học đã được enroll (mock — sau này từ API) ───────────────────
export const ENROLLED_IDS = new Set(["hsa-tron-goi", "toan-12", "combo-8-mon"]);

// ─── Helper: lấy course theo id (slug) ────────────────────────────────────────
export function getCourseById(id: string): MasterCourse | undefined {
  return COURSES.find(c => c.id === id);
}

// ─── Helper: lấy course theo adminId (số) ────────────────────────────────────
export function getCourseByAdminId(adminId: number): MasterCourse | undefined {
  return COURSES.find(c => c.adminId === adminId);
}

// ─── Helper: slug → adminId mapping ──────────────────────────────────────────
// Tìm slug theo cả tên công khai (name) lẫn tên nội bộ (adminName)
export function getSlugByAdminName(displayName: string): string {
  const q = displayName.toLowerCase();
  return COURSES.find(c =>
    c.name.toLowerCase().includes(q) ||
    q.includes(c.name.toLowerCase()) ||
    c.adminName.toLowerCase().includes(q) ||
    q.includes(c.adminName.toLowerCase())
  )?.id ?? "";
}

// ─── Derived views cho từng role ─────────────────────────────────────────────

/** Admin CMS: danh sách khóa học */
export function getAdminCourses(): AdminCourse[] {
  return COURSES.map(c => ({
    adminId:   c.adminId,
    adminName: c.adminName,
    id:        c.id,
    category:  c.category,
    instructor:c.instructor,
    status:    c.status,
    createdAt: c.createdAt,
  }));
}

/** Guest catalog: tất cả khóa học */
export function getCatalogCourses(): (CatalogCourse & { title: string })[] {
  return COURSES.map(({ adminId: _a, adminName: _n, status: _s, createdAt: _c, ...rest }) => ({
    ...rest,
    title: rest.name,
  }));
}

/** Student: danh sách tất cả khóa học (ALL_COURSES) */
export const ALL_COURSES = getCatalogCourses();

/** Danh mục chuẩn — dùng chung toàn hệ thống */
export const COURSE_CATEGORIES = [
  "Tất cả",
  "ĐGNL HSA",
  "Tốt nghiệp THPT",
  "TSA Bách Khoa",
  "BCA",
] as const;

export type CourseCategory = typeof COURSE_CATEGORIES[number];

/** Admin filter — không có "Tất cả" */
export const ADMIN_CATEGORIES = COURSE_CATEGORIES.slice(1) as readonly string[];

/** Hashtag mô tả nhanh cho từng khóa học — dùng trên card và trang chi tiết */
export const COURSE_HASHTAGS: Record<string, string[]> = {
  "hsa-tron-goi":  ["Trọn gói", "Video", "Live"],
  "toan-12":       ["Toán 12", "Video", "Live"],
  "combo-8-mon":   ["8 môn", "Combo", "Video", "Live"],
  "hsa-toan":      ["Toán", "Video", "Chuyên sâu"],
  "hsa-van":       ["Ngữ văn", "Video", "Live"],
  "hcm-tron-goi":  ["Trọn gói", "Video", "Live"],
  "tsa-bach-khoa": ["TSA", "Video", "Live"],
  "bca-2k8":       ["BCA", "Video", "2K8"],
};

/** Gradient màu theo danh mục — dùng chung admin/guest/student */
export const CATEGORY_GRADIENT: Record<string, string> = {
  "ĐGNL HSA":        "linear-gradient(135deg,#0042AA,#0068FF,#38BDF8)",
  "Tốt nghiệp THPT": "linear-gradient(135deg,#15803D,#16a34a,#4ADE80)",
  "ĐGNL HCM":        "linear-gradient(135deg,#6D28D9,#8B5CF6,#C4B5FD)",
  "TSA Bách Khoa":   "linear-gradient(135deg,#C2410C,#EA580C,#FB923C)",
  "BCA":             "linear-gradient(135deg,#1E2938,#374151,#6B7280)",
};
