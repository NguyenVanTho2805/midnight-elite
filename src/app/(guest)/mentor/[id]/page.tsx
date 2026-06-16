import Link from "next/link";
import { Star, BookOpen, Users, Time, ArrowLeft, CheckCircle } from "griddy-icons";

interface MentorData {
  id: string;
  name: string;
  subject: string;
  bio: string;
  rating: number;
  totalStudents: number;
  totalSessions: number;
  experience: string;
  education: string[];
  achievements: string[];
  courses: Array<{ id: string; title: string; students: number; rating: number }>;
  schedule: string;
  avatar: string;
}

const MENTORS: Record<string, MentorData> = {
  "thay-minh": {
    id: "thay-minh", name: "Thầy Nguyễn Hoàng Minh", subject: "Toán học", avatar: "M",
    bio: "Giáo viên Toán với hơn 8 năm kinh nghiệm luyện thi ĐGNL và THPT. Từng đạt giải Ba Olympic Toán Quốc gia, thầy Minh nổi tiếng với phương pháp giảng dạy trực quan, giúp học sinh hiểu sâu thay vì học vẹt. Hơn 2.000 học viên đã đạt điểm Toán từ 8.0 trở lên dưới sự hướng dẫn của thầy.",
    rating: 4.9, totalStudents: 2140, totalSessions: 380, experience: "8 năm",
    education: ["Cử nhân Sư phạm Toán — ĐHSP Hà Nội (Loại Giỏi)", "Thạc sĩ Toán học ứng dụng — ĐH Bách Khoa Hà Nội"],
    achievements: ["Giải Ba Olympic Toán Quốc gia 2012", "Top 10 giáo viên được yêu thích Midnight Elite 2025", "Tỉ lệ học viên đạt 8.0+ Toán: 78%"],
    courses: [
      { id: "toan-dgnl-hsa", title: "Toán ĐGNL HSA — Từ cơ bản đến nâng cao", students: 1240, rating: 4.9 },
      { id: "toan-thpt-2026", title: "Toán THPT Quốc gia 2026 — Luyện đề chuyên sâu", students: 890, rating: 4.8 },
    ],
    schedule: "Thứ 2, Thứ 6, Chủ nhật — 19:30–21:00",
  },
  "co-huong": {
    id: "co-huong", name: "Cô Trần Thu Hương", subject: "Hóa học", avatar: "H",
    bio: "Cô Hương là chuyên gia Hóa học với 6 năm kinh nghiệm giảng dạy tại các trường chuyên và trung tâm luyện thi uy tín. Chuyên sâu về Hóa Vô cơ và Hóa Hữu cơ — hai phần trọng tâm trong đề thi ĐGNL. Cô nổi bật với các sơ đồ tư duy màu sắc giúp học viên ghi nhớ phản ứng hóa học dễ dàng.",
    rating: 4.8, totalStudents: 1560, totalSessions: 290, experience: "6 năm",
    education: ["Cử nhân Hóa học — ĐHKH Tự nhiên TP.HCM (Loại Xuất sắc)", "Chứng chỉ Sư phạm Quốc tế Cambridge"],
    achievements: ["Học viên đạt điểm Hóa tuyệt đối ĐGNL 2025: 12 người", "Giáo viên được vote nhiều nhất tháng 3/2026 — Midnight Elite"],
    courses: [
      { id: "hoa-dgnl", title: "Hóa học ĐGNL — Toàn bộ chương trình", students: 980, rating: 4.8 },
    ],
    schedule: "Thứ 2, Thứ 5 — 20:00–21:30",
  },
  "thay-long": {
    id: "thay-long", name: "Thầy Phạm Đức Long", subject: "Vật lý", avatar: "L",
    bio: "Thầy Long từng là kỹ sư tại Samsung Việt Nam trước khi chuyển sang giảng dạy, mang lại góc nhìn thực tế độc đáo cho môn Vật lý. Chuyên về Vật lý hiện đại, Sóng và Điện xoay chiều — các phần thường xuất hiện trong đề thi khó.",
    rating: 4.7, totalStudents: 1120, totalSessions: 215, experience: "5 năm",
    education: ["Cử nhân Kỹ thuật Điện tử — ĐH Bách Khoa TP.HCM", "Kỹ sư tại Samsung Electronics Vietnam (2016–2021)"],
    achievements: ["Tỉ lệ học viên đạt 7.5+ Vật lý: 71%", "Kênh YouTube Vật lý thực tế: 45K subscribers"],
    courses: [
      { id: "vat-ly-dgnl", title: "Vật lý ĐGNL — Luyện từ đề Mock đến đề thật", students: 760, rating: 4.7 },
    ],
    schedule: "Thứ 3, Thứ 6 — 19:30–21:00",
  },
};

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mentor = MENTORS[id];

  if (!mentor) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#1E2938" }}>Không tìm thấy mentor</h1>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Mentor này không tồn tại hoặc đã ngừng hoạt động.</p>
        <Link href="/khoa-hoc" className="px-6 py-3 rounded-lg font-semibold text-white text-sm"
          style={{ background: "#0068FF", borderRadius: "8px" }}>
          Xem tất cả khóa học
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Back */}
      <Link href="/khoa-hoc" className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "#6B7280" }}>
        <ArrowLeft size={16} /> Quay lại
      </Link>

      {/* Hero card */}
      <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-black flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
            {mentor.avatar}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>{mentor.name}</h1>
              <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ background: "#0068FF" }}>
                {mentor.subject}
              </span>
            </div>
            <p className="text-sm leading-relaxed mt-2" style={{ color: "#4B5563" }}>{mentor.bio}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { Icon: Star, value: mentor.rating, label: "Đánh giá", color: "#FE9900" },
                { Icon: Users, value: `${(mentor.totalStudents / 1000).toFixed(1)}K`, label: "Học viên", color: "#0068FF" },
                { Icon: BookOpen, value: mentor.totalSessions, label: "Buổi dạy", color: "#00A63D" },
                { Icon: Time, value: mentor.experience, label: "Kinh nghiệm", color: "#FF2157" },
              ].map(({ Icon, value, label, color }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <Icon size={18} style={{ color, margin: "0 auto 4px" }} />
                  <div className="font-extrabold text-base" style={{ color: "#1E2938" }}>{value}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Education & Achievements */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <h2 className="font-extrabold text-sm mb-3" style={{ color: "#1E2938" }}>Học vấn</h2>
            <ul className="space-y-2">
              {mentor.education.map((e) => (
                <li key={e} className="flex items-start gap-2 text-sm" style={{ color: "#4B5563" }}>
                  <CheckCircle size={15} style={{ color: "#0068FF", flexShrink: 0, marginTop: 2 }} />
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <h2 className="font-extrabold text-sm mb-3" style={{ color: "#1E2938" }}>Thành tích nổi bật</h2>
            <ul className="space-y-2">
              {mentor.achievements.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm" style={{ color: "#4B5563" }}>
                  <span style={{ color: "#FE9900" }}>★</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
            <h2 className="font-extrabold text-sm mb-2" style={{ color: "#1E2938" }}>Lịch dạy cố định</h2>
            <p className="text-sm" style={{ color: "#4B5563" }}>{mentor.schedule}</p>
          </div>
        </div>

        {/* Courses */}
        <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <h2 className="font-extrabold text-sm mb-4" style={{ color: "#1E2938" }}>Khóa học đang dạy</h2>
          <div className="space-y-3">
            {mentor.courses.map((c) => (
              <Link key={c.id} href={`/khoa-hoc/${c.id}`}>
                <div className="rounded-xl p-4 cursor-pointer hover:-translate-y-0.5 transition-transform"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <p className="font-semibold text-sm leading-snug mb-2" style={{ color: "#1E2938" }}>{c.title}</p>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "#9CA3AF" }}>
                    <span style={{ color: "#FE9900" }}>★ {c.rating}</span>
                    <span>·</span>
                    <span>{c.students.toLocaleString()} học viên</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Link href="/dang-ky" className="mt-4 w-full block text-center py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            Đăng ký học với {mentor.name.split(" ").pop()}
          </Link>
        </div>
      </div>
    </div>
  );
}
