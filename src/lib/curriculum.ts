import type { Section } from "./types";

// ─── CURRICULUM DATA ──────────────────────────────────────────────────────────
// Chứa toàn bộ sections/chapters/lessons của từng khóa học.
// Key = course id (slug). Thêm khóa mới → thêm entry mới vào đây.

export const CURRICULUM: Record<string, Section[]> = {

  // ──────────────────────────────────────────────────────────────────────────
  "hsa-tron-goi": [
    {
      id: "s1", title: "PHẦN 1. TOÁN HỌC — XỬ LÝ SỐ LIỆU",
      chapters: [
        {
          id: "c1-1", title: "Chương 1: Thống kê mô tả",
          lessons: [
            { id: "b00-intro-hsa", code: "B00.GI",  title: "Giới thiệu khóa học HSA Trọn gói",            type: "record",   duration: "15:00", isCompleted: true,  isLocked: false, isFree: true,  stats: { videos: 1, materials: 1, views: 3421 } },
            { id: "b01-nt01",      code: "B01.NT01", title: "Xử lý số liệu — Trung bình, Mode, Trung vị", type: "record",   duration: "48:32", isCompleted: true,  isLocked: false, isFree: false, stats: { videos: 1, materials: 3, views: 1240 } },
            { id: "b02-nt01",      code: "B02.NT01", title: "Quy luật số & Dãy số đặc biệt",              type: "record",   duration: "35:10", isCompleted: false, isLocked: false, isFree: false, stats: { videos: 1, materials: 2, views: 892  } },
            { id: "b03-nt01",      code: "B03.NT01", title: "Quiz Chương 1 — Thống kê",                   type: "quiz",                        isCompleted: false, isLocked: false, isFree: false, stats: { videos: 0, materials: 1, views: 0    } },
            { id: "b04-nt01",      code: "B04.NT01", title: "Xác suất cơ bản & Tổ hợp",                  type: "record",   duration: "52:18", isCompleted: false, isLocked: true,  isFree: false, stats: { videos: 1, materials: 2, views: 0    } },
          ],
        },
        {
          id: "c1-2", title: "Chương 2: Hàm số & Đồ thị",
          lessons: [
            { id: "b05-nt02", code: "B05.NT02", title: "Hàm số bậc nhất và bậc hai", type: "record", duration: "41:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "b06-nt02", code: "B06.NT02", title: "LIVE — Q&A Hàm số (Zoom)",   type: "live",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 0, views: 0 } },
            { id: "b07-nt02", code: "B07.NT02", title: "Bài tập tổng hợp Hàm số",    type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 1, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "s2", title: "PHẦN 2. NGỮ VĂN — TƯ DUY ĐỊNH TÍNH",
      chapters: [
        {
          id: "c2-1", title: "Chương 1: Đọc hiểu văn bản",
          lessons: [
            { id: "b08-van1", code: "B08.VN01", title: "Kỹ năng đọc hiểu — Phương thức biểu đạt", type: "record", duration: "38:20", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "b09-van1", code: "B09.VN01", title: "Phân tích văn bản nghị luận",              type: "record", duration: "42:10", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 1, views: 0 } },
          ],
        },
        {
          id: "c2-2", title: "Chương 2: Làm văn",
          lessons: [
            { id: "b10-van2", code: "B10.VN02", title: "Viết đoạn văn nghị luận xã hội",  type: "document", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 3, views: 0 } },
            { id: "b11-van2", code: "B11.VN02", title: "Quiz Văn học — Nghị luận văn học", type: "quiz",     isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 1, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "s3", title: "PHẦN 3. KHOA HỌC TỰ NHIÊN",
      chapters: [
        {
          id: "c3-1", title: "Chương 1: Vật lý — Sóng & Dao động",
          lessons: [
            { id: "b12-kh1", code: "B12.KH01", title: "Dao động điều hòa — Lý thuyết",           type: "record", duration: "44:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "b13-kh1", code: "B13.KH01", title: "Sóng cơ — Sóng âm toàn tập",              type: "record", duration: "51:20", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "b14-kh1", code: "B14.KH01", title: "LIVE — Giải đề Vật lý thực chiến (Zoom)", type: "live",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 0, views: 0 } },
          ],
        },
      ],
    },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  "toan-12": [
    {
      id: "t12-s1", title: "PHẦN 1. KHẢO SÁT HÀM SỐ",
      chapters: [
        {
          id: "t12-c1-1", title: "Chương 1: Tính chất & đồ thị hàm số",
          lessons: [
            { id: "t12-b01", code: "T01.HS", title: "Tính đơn điệu", type: "record", duration: "42:00", isCompleted: false, isLocked: false, isFree: true,  stats: { videos: 1, materials: 2, views: 1240 } },
            { id: "t12-b02", code: "T02.HS", title: "Cực trị",        type: "record", duration: "38:30", isCompleted: false, isLocked: false, isFree: false, stats: { videos: 1, materials: 2, views: 856  } },
            { id: "t12-b03", code: "T03.HS", title: "GTLN – GTNN",    type: "record", duration: "45:10", isCompleted: false, isLocked: false, isFree: false, stats: { videos: 1, materials: 3, views: 743  } },
            { id: "t12-b04", code: "T04.HS", title: "Tiệm cận",       type: "record", duration: "35:00", isCompleted: false, isLocked: true,  isFree: false, stats: { videos: 1, materials: 2, views: 0    } },
          ],
        },
        {
          id: "t12-c1-2", title: "Chương 2: Các dạng hàm số & ôn tập",
          lessons: [
            { id: "t12-b05", code: "T05.HS", title: "Hàm số bậc 3",       type: "record", duration: "50:20", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
            { id: "t12-b06", code: "T06.HS", title: "Hàm số hữu tỉ",      type: "record", duration: "46:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b07", code: "T07.HS", title: "Ôn tập chương KSHS", type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 2, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s2", title: "PHẦN 2. VECTO TRONG KHÔNG GIAN",
      chapters: [
        {
          id: "t12-c2-1", title: "Chương 1: Vecto & Phép toán",
          lessons: [
            { id: "t12-b08", code: "T08.VT", title: "Vecto trong không gian", type: "record", duration: "40:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b09", code: "T09.VT", title: "Các phép toán VECTO",    type: "record", duration: "44:30", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b10", code: "T10.VT", title: "Ôn tập chương VECTO",    type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 1, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s3", title: "PHẦN 3. THỐNG KÊ",
      chapters: [
        {
          id: "t12-c3-1", title: "Chương 1: Mẫu số liệu",
          lessons: [
            { id: "t12-b11", code: "T11.TK", title: "Thống kê – mẫu số liệu không ghép nhóm",                  type: "record", duration: "38:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b12", code: "T12.TK", title: "Số đặc trưng đo phân tán – Mẫu số liệu không ghép nhóm", type: "record", duration: "42:15", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b13", code: "T13.TK", title: "Số đặc trưng – Mẫu số liệu ghép nhóm",                   type: "record", duration: "40:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b14", code: "T14.TK", title: "Số đặc trưng đo phân tán – mẫu số liệu ghép nhóm",       type: "record", duration: "45:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b15", code: "T15.TK", title: "Ôn tập chương thống kê",                                  type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 2, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s4", title: "PHẦN 4. NGUYÊN HÀM – TÍCH PHÂN",
      chapters: [
        {
          id: "t12-c4-1", title: "Chương 1: Nguyên hàm & Tích phân",
          lessons: [
            { id: "t12-b16", code: "T16.TP", title: "Nguyên hàm",                    type: "record", duration: "48:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
            { id: "t12-bcd", code: "TCD.TP", title: "CĐ TOÁN THỰC TẾ 12 2026",       type: "live",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 1, views: 0 } },
            { id: "t12-b17", code: "T17.TP", title: "Tích phân",                      type: "record", duration: "52:30", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
            { id: "t12-b18", code: "T18.TP", title: "Ứng dụng của Tích phân",         type: "record", duration: "44:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b19", code: "T19.TP", title: "Ôn tập chương",                  type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 2, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s5", title: "PHẦN 5. HÌNH HỌC GIẢI TÍCH KHÔNG GIAN",
      chapters: [
        {
          id: "t12-c5-1", title: "Chương 1: Phương trình hình học",
          lessons: [
            { id: "t12-b20", code: "T20.HH", title: "Phương trình mặt phẳng",   type: "record", duration: "46:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b21", code: "T21.HH", title: "Phương trình đường thẳng", type: "record", duration: "44:30", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b22", code: "T22.HH", title: "Phương trình mặt cầu",     type: "record", duration: "40:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b23", code: "T23.HH", title: "Ôn Tập chương",            type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 1, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s6", title: "PHẦN 6. TỔ HỢP & XÁC SUẤT",
      chapters: [
        {
          id: "t12-c6-1", title: "Chương 1: Xác suất",
          lessons: [
            { id: "t12-b24", code: "T24.XS", title: "Tổ Hợp",                                  type: "record", duration: "42:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b25", code: "T25.XS", title: "Định nghĩa xác suất",                      type: "record", duration: "38:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b26", code: "T26.XS", title: "Quy tắc tính xác suất",                    type: "record", duration: "41:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b27", code: "T27.XS", title: "Xác suất có điều kiện",                    type: "record", duration: "45:20", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b28", code: "T28.XS", title: "Công thức xác xuất toàn phần và BAYES",    type: "record", duration: "50:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
            { id: "t12-b29", code: "T29.XS", title: "Ôn tập chương xác suất",                   type: "quiz",                      isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 2, views: 0 } },
          ],
        },
      ],
    },
    {
      id: "t12-s7", title: "PHẦN 7. ÔN TẬP & ĐỀ THI",
      chapters: [
        {
          id: "t12-c7-1", title: "Chương 1: Ôn tập kiến thức lớp 11",
          lessons: [
            { id: "t12-b30", code: "T30.OT", title: "Ôn tập lượng giác 11",                    type: "record", duration: "40:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b31", code: "T31.OT", title: "Ôn tập DS – CSC – CSN lớp 11",            type: "record", duration: "44:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b32", code: "T32.OT", title: "Ôn tập giới hạn lớp 11",                  type: "record", duration: "38:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b33", code: "T33.OT", title: "Ôn tập LOGARIT lớp 11",                   type: "record", duration: "42:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b34", code: "T34.OT", title: "Ôn tập quan hệ vuông góc lớp 11",         type: "record", duration: "45:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
            { id: "t12-b35", code: "T35.OT", title: "Một số bài toán liên hệ 10 – 11 – 12",    type: "record", duration: "55:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
          ],
        },
        {
          id: "t12-c7-2", title: "Chương 2: Đề thi",
          lessons: [
            { id: "t12-dck", code: "T.DCK", title: "ĐỀ CK lớp 12", type: "document", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 5, views: 0 } },
            { id: "t12-dgk", code: "T.DGK", title: "Đề GK lớp 12", type: "document", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 0, materials: 5, views: 0 } },
          ],
        },
      ],
    },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  "combo-8-mon": [
    {
      id: "cb1", title: "PHẦN 1. TOÁN + VẬT LÝ + HÓA",
      chapters: [
        {
          id: "cb1-1", title: "Chương 1: Toán — Đại số & Giải tích",
          lessons: [
            { id: "cb-b01", code: "CB01.T", title: "Tổng quan chương trình Toán 12",    type: "record", duration: "20:00", isCompleted: false, isLocked: false, isFree: true,  stats: { videos: 1, materials: 1, views: 0 } },
            { id: "cb-b02", code: "CB02.T", title: "Hàm số — Tất cả dạng bài thi THPT", type: "record", duration: "55:00", isCompleted: false, isLocked: true,  isFree: false, stats: { videos: 1, materials: 4, views: 0 } },
          ],
        },
        {
          id: "cb1-2", title: "Chương 2: Vật lý — Dao động & Sóng",
          lessons: [
            { id: "cb-b03", code: "CB03.L", title: "Dao động điều hòa toàn tập", type: "record", duration: "48:00", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 3, views: 0 } },
            { id: "cb-b04", code: "CB04.L", title: "Sóng cơ & Giao thoa sóng",   type: "record", duration: "42:30", isCompleted: false, isLocked: true, isFree: false, stats: { videos: 1, materials: 2, views: 0 } },
          ],
        },
      ],
    },
  ],
};

// ─── Helper: build EnrolledCourse từ COURSES + CURRICULUM ────────────────────
import { COURSES, ENROLLED_IDS } from "./courseData";
import type { EnrolledCourse } from "./types";

export function getEnrolledCourses(): EnrolledCourse[] {
  return COURSES
    .filter(c => ENROLLED_IDS.has(c.id))
    .map(c => ({
      id:           c.id,
      title:        c.name,
      shortTitle:   c.shortTitle,
      category:     c.category,
      bg:           c.bg,
      instructor:   c.instructor,
      teacherAvatar:c.teacherAvatar,
      openDate:     c.openDate,
      types:        c.types,
      sections:     CURRICULUM[c.id] ?? [],
    }));
}

export function getEnrolledCourse(id: string): EnrolledCourse | undefined {
  return getEnrolledCourses().find(c => c.id === id);
}
