export interface Teacher {
  slug:        string;
  name:        string;
  avatar:      string;
  title:       string;
  specialties: string[];
  bio:         string;
  courses:     string[];   // course IDs
  socials?: { zalo?: string; facebook?: string };
}

export const TEACHERS: Teacher[] = [
  {
    slug:        "do-duc",
    name:        "Thầy Đỗ Đức",
    avatar:      "Đ",
    title:       "Giảng viên Toán & Tư duy Định lượng",
    specialties: ["Toán ĐGNL HSA", "Tư duy định lượng", "Hình học - Giải tích"],
    bio:         "Thầy Đỗ Đức có hơn 7 năm kinh nghiệm luyện thi ĐGNL HSA. Phương pháp giảng dạy kết hợp tư duy logic với luyện đề thực chiến, giúp học sinh tăng 1.5–2 điểm sau 3 tháng học.",
    courses:     ["hsa-tron-goi", "hsa-toan"],
    socials:     { zalo: "0384409051" },
  },
  {
    slug:        "nguyen-minh",
    name:        "Thầy Nguyễn Minh",
    avatar:      "M",
    title:       "Giảng viên Toán lớp 12 & Tốt nghiệp THPT",
    specialties: ["Toán 12 THPT", "Đại số - Giải tích", "Xác suất - Thống kê"],
    bio:         "Thầy Nguyễn Minh chuyên ôn luyện Toán tốt nghiệp THPT với tỉ lệ học viên đạt 8+ điểm lên đến 85%. Tác giả bộ đề luyện tập 12 chương trình THPT được hơn 2,000 học sinh sử dụng.",
    courses:     ["toan-12", "combo-8-mon"],
    socials:     { zalo: "0384409051" },
  },
  {
    slug:        "tran-linh",
    name:        "Cô Trần Linh",
    avatar:      "L",
    title:       "Giảng viên Ngữ văn & Tư duy Định tính",
    specialties: ["Ngữ văn ĐGNL HSA", "Tư duy định tính", "Đọc hiểu - Nghị luận"],
    bio:         "Cô Trần Linh là chuyên gia phần Tư duy Định tính ĐGNL HSA với kinh nghiệm 5 năm giảng dạy. Phong cách rõ ràng, logic — học viên thường tăng 15–20% điểm phần Ngữ văn & Đọc hiểu sau 6 tuần.",
    courses:     ["hsa-tron-goi", "hsa-van"],
    socials:     { zalo: "0384409051" },
  },
  {
    slug:        "pham-hung",
    name:        "Thầy Phạm Hùng",
    avatar:      "H",
    title:       "Giảng viên ĐGNL HCM Trọn gói",
    specialties: ["ĐGNL ĐHQG TP.HCM", "Khoa học Tự nhiên", "Toán ứng dụng"],
    bio:         "Thầy Phạm Hùng có 6 năm kinh nghiệm ôn thi ĐGNL ĐHQG TP.HCM. Am hiểu sâu cấu trúc đề thi HCM, thiết kế lộ trình cá nhân hoá theo điểm đầu vào của từng học sinh.",
    courses:     ["hcm-tron-goi"],
    socials:     { zalo: "0384409051" },
  },
  {
    slug:        "le-van-an",
    name:        "Thầy Lê Văn An",
    avatar:      "A",
    title:       "Giảng viên TSA Bách Khoa",
    specialties: ["TSA Đại học Bách Khoa HN", "Tư duy Logic", "Toán kỹ thuật"],
    bio:         "Thầy Lê Văn An tốt nghiệp Kỹ sư Bách Khoa HN và có 4 năm luyện thi TSA chuyên sâu. Hiểu rõ cấu trúc đặc thù của TSA, xây dựng chiến lược làm bài tối ưu cho từng phần.",
    courses:     ["tsa-bach-khoa"],
    socials:     { zalo: "0384409051" },
  },
];

export function getTeacherBySlug(slug: string): Teacher | undefined {
  return TEACHERS.find(t => t.slug === slug);
}

export function getTeacherByName(name: string): Teacher | undefined {
  return TEACHERS.find(t => t.name === name || name.includes(t.name) || t.name.includes(name));
}
