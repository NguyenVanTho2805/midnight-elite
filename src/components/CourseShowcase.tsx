import Link from "next/link";
import { BookOpen, Star, Rocket } from "griddy-icons";

const courses = [
  {
    Icon: BookOpen,
    tag: "Phổ biến nhất",
    tagColor: "#0068FF",
    title: "Lớp 12 & Tốt nghiệp THPT",
    description: "Hệ thống bài giảng video đầy đủ 8 môn cốt lõi theo chuyên đề. Kèm bài tập tự luyện và thi thử.",
    subjects: ["Toán", "Vật lý", "Hóa học", "Sinh học", "Ngữ văn", "Lịch sử", "Địa lý", "Tiếng Anh"],
    price: "từ 500.000đ",
    combo: "Combo 8 môn: 1.500.000đ",
    href: "/khoa-hoc/tot-nghiep",
    accent: "#0068FF",
  },
  {
    Icon: Star,
    tag: "Doanh thu cao nhất",
    tagColor: "#FE9900",
    title: "ĐGNL Đại học Quốc gia Hà Nội (HSA)",
    description: "Tư duy định lượng, định tính và Khoa học. Mô phỏng đề thi thực tế. Chiến lược làm bài tối ưu.",
    subjects: ["Tư duy Toán", "Tư duy Văn", "Khoa học Tự nhiên", "Khoa học Xã hội"],
    price: "1.500.000đ",
    combo: "Trọn gói lộ trình HSA",
    href: "/khoa-hoc/hsa",
    accent: "#FE9900",
  },
  {
    Icon: Rocket,
    tag: "Xu hướng 2025",
    tagColor: "#FF2157",
    title: "ĐGNL HCM & TSA Bách Khoa",
    description: "Năng lực ngôn ngữ, logic, phân tích số liệu. Tư duy Toán học và Khoa học chuyên sâu cho TSA.",
    subjects: ["ĐGNL HCM", "Tư duy Bách Khoa (TSA)", "Đọc hiểu nâng cao", "Logic & Phân tích"],
    price: "1.500.000đ",
    combo: "Combo ĐGNL HCM + TSA",
    href: "/khoa-hoc/hcm-tsa",
    accent: "#FF2157",
  },
];

export default function CourseShowcase() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: "#F0F5FF" }}>
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", color: "#0068FF" }}
          >
            Sản phẩm nổi bật
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: "#1E2938" }}>
            Lộ trình học tập <span style={{ color: "#0068FF" }}>được thiết kế</span> cho từng mục tiêu
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: "#6B7280" }}>
            Không học lan man. Mỗi khóa học được thiết kế sát đề thi thực tế, có lộ trình rõ ràng và mentor hỗ trợ.
          </p>
        </div>

        {/* Course cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.title}
              className="rounded-3xl p-6 flex flex-col"
              style={{ background: "#F0F5FF", boxShadow: "12px 12px 24px #C5D0EA, -12px -12px 24px #ffffff" }}
            >
              {/* Top */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA, -4px -4px 8px #ffffff", color: course.accent }}
                >
                  <course.Icon size={24} />
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: course.tagColor }}
                >
                  {course.tag}
                </span>
              </div>

              {/* Title & desc */}
              <h3 className="text-lg font-bold mb-2" style={{ color: "#1E2938" }}>{course.title}</h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "#6B7280" }}>{course.description}</p>

              {/* Subjects */}
              <div className="flex flex-wrap gap-2 mb-6">
                {course.subjects.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA, inset -2px -2px 4px #ffffff", color: "#4B5563" }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Pricing */}
              <div
                className="rounded-2xl p-4 mb-5"
                style={{ background: "#F0F5FF", boxShadow: "inset 4px 4px 8px #C5D0EA, inset -4px -4px 8px #ffffff" }}
              >
                <div className="text-xs mb-1" style={{ color: "#6B7280" }}>Giá bán lẻ</div>
                <div className="text-xl font-extrabold mb-0.5" style={{ color: course.accent }}>{course.price}</div>
                <div className="text-xs font-medium" style={{ color: "#1E2938" }}>{course.combo}</div>
              </div>

              {/* CTA */}
              <Link
                href={course.href}
                className="mt-auto w-full py-3 rounded-2xl text-sm font-bold text-center transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "linear-gradient(145deg, #0055D4, #0042AA)", boxShadow: "6px 6px 12px #C5D0EA, -6px -6px 12px #ffffff", color: "white" }}
              >
                Xem chi tiết →
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <Link
            href="/khoa-hoc"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold"
            style={{ color: "#0068FF", background: "#F0F5FF", boxShadow: "6px 6px 12px #C5D0EA, -6px -6px 12px #ffffff" }}
          >
            Xem tất cả khóa học
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
