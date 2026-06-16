// ─── Shared types — used by admin, guest, and student roles ───────────────────

export type LessonType = "record" | "live" | "quiz" | "document";

export interface LessonStats {
  videos: number;
  materials: number;
  views: number;
}

export interface Lesson {
  id: string;
  code: string;
  title: string;
  type: LessonType;
  duration?: string;
  isCompleted: boolean;
  isLocked: boolean;
  isFree: boolean;
  stats: LessonStats;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Section {
  id: string;
  title: string;
  chapters: Chapter[];
}

// ─── Master course shape — single source of truth ─────────────────────────────
export interface MasterCourse {
  // Định danh
  id: string;          // slug — ID chính toàn hệ thống
  adminId: number;     // ID số trong admin CMS

  // Tên
  name: string;        // tên chính thức hiển thị ở student/guest
  adminName: string;   // tên đầy đủ trong admin CMS
  shortTitle: string;  // tên ngắn 2 dòng cho thumbnail (\n tách dòng)

  // Phân loại
  category: string;
  instructor: string;
  teacherAvatar: string;

  // Lịch
  openDate: string;
  types: string[];     // ["Video", "Live"]

  // Visual
  bg: string;          // gradient CSS
  strip: string;       // màu strip vàng

  // Tag
  tag?: string;
  tagColor?: string;

  // Giá
  price: number;
  originalPrice?: number;

  // Thống kê
  lessons: number;
  hours: number;

  // Admin
  status: boolean;
  createdAt: string;
}

// ─── Derived shapes (mỗi role dùng subset) ────────────────────────────────────

/** Admin CMS table row */
export type AdminCourse = Pick<MasterCourse,
  "adminId" | "adminName" | "id" | "category" | "instructor" | "status" | "createdAt"
>;

/** Guest catalog card */
export type CatalogCourse = Omit<MasterCourse, "adminId" | "adminName" | "status" | "createdAt"> & {
  id: string; // slug
};

/** Student enrolled course (metadata only, curriculum in CURRICULUM) */
export interface EnrolledCourse {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  bg: string;
  instructor: string;
  teacherAvatar: string;
  openDate: string;
  types: string[];
  sections: Section[];
}
