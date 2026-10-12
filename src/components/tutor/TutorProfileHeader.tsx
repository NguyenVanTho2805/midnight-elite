// FE-158 — đầu hồ sơ gia sư dùng chung: ảnh, tên, nhãn tin cậy, môn dạy, giới thiệu, bốn con số.
// Dùng ở hồ sơ công khai /mentor/[id] và ở bản xem trước trong Hồ sơ gia sư (Dashboard). Tách nguyên văn từ trang hồ sơ, không đổi giao diện.
import { Star, BookOpen, Users, CalendarCheck } from "griddy-icons";
import { initials } from "@/components/tutor/TutorCard";

export interface ProfileHeaderTutor { name: string; avatarBase64: string | null; bio: string | null; subjects: string[]; tutorVerified: boolean }
export interface ProfileHeaderStats { classCount: number; studentCount: number; sessionsTaught: number; rating: { avg: number | null; total: number } }

/** `as`: cấp tiêu đề của tên gia sư — "h1" ở trang hồ sơ công khai, "h2" khi nhúng vào trang đã có h1 (xem trước ở Hồ sơ gia sư). */
export default function TutorProfileHeader({ tutor, stats, as: Heading = "h1" }: { tutor: ProfileHeaderTutor; stats: ProfileHeaderStats; as?: "h1" | "h2" }) {
  const avgText = stats.rating.avg !== null ? stats.rating.avg.toFixed(1) : "—";
  return (
    <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-black flex-shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
          {tutor.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={tutor.avatarBase64} alt={tutor.name} className="w-full h-full object-cover" />
            : initials(tutor.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Heading className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>{tutor.name}</Heading>
            {tutor.tutorVerified && (
              <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ background: "#00A63D" }}>Đã xác minh</span>
            )}
            {/* PH-207/212: lời hứa của KiN với gia sư, nhìn thấy được trên hồ sơ chứ không chỉ nằm trong điều khoản */}
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>Không thu phí nhận lớp</span>
          </div>
          {tutor.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tutor.subjects.map(s => (
                <span key={s} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#dbeafe", color: "#0068FF" }}>{s}</span>
              ))}
            </div>
          )}

          {/* FE-111: Bio đầy đủ (không line-clamp ở trang chi tiết). */}
          {tutor.bio && (
            <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: "#4B5563" }}>{tutor.bio}</p>
          )}

          {/* FE-112: Stat thật (không hard-code) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { Icon: Star, value: avgText, label: stats.rating.total > 0 ? `${stats.rating.total} đánh giá` : "chưa có", color: "#FE9900" },
              { Icon: Users, value: stats.studentCount.toLocaleString(), label: "Học viên", color: "#0068FF" },
              { Icon: BookOpen, value: stats.classCount, label: "Lớp đang dạy", color: "#00A63D" },
              { Icon: CalendarCheck, value: stats.sessionsTaught.toLocaleString(), label: "Buổi đã dạy (theo sổ lớp)", color: "#7C3AED" },
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
  );
}
