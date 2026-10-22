// FE-158 — đầu hồ sơ gia sư dùng chung: ảnh, tên, nhãn tin cậy, môn dạy, giới thiệu, bốn con số.
// Dùng ở hồ sơ công khai /mentor/[id] và ở bản xem trước trong Hồ sơ gia sư (Dashboard). Tách nguyên văn từ trang hồ sơ, không đổi giao diện.
import { Star, BookOpen, Users, CalendarCheck } from "griddy-icons";
import { initials } from "@/components/tutor/TutorCard";
import { MODE_LABEL, areaLine, hasPublicArea, priceText, type PublicArea } from "@/lib/tutorArea";

export interface ProfileHeaderTutor { name: string; avatarBase64: string | null; bio: string | null; subjects: string[]; tutorVerified: boolean; /** ĐX-06: khu vực / hình thức / trường + bằng cấp / giá tham khảo, TỰ KHAI. */ area?: PublicArea | null }
export interface ProfileHeaderStats { classCount: number; studentCount: number; sessionsTaught: number; /** ĐX-05: có ít nhất 1 buổi đã dạy trong 30 ngày qua. */ recentlyActive?: boolean; rating: { avg: number | null; total: number } }

/** `as`: cấp tiêu đề của tên gia sư — "h1" ở trang hồ sơ công khai, "h2" khi nhúng vào trang đã có h1 (xem trước ở Hồ sơ gia sư). */
export default function TutorProfileHeader({ tutor, stats, as: Heading = "h1" }: { tutor: ProfileHeaderTutor; stats: ProfileHeaderStats; as?: "h1" | "h2" }) {
  const avgText = stats.rating.avg !== null ? stats.rating.avg.toFixed(1) : "—";
  return (
    <div className="rounded-xl p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-black flex-shrink-0 overflow-hidden"
          style={{ background: "var(--kin-nhan-nen)" }}>
          {tutor.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={tutor.avatarBase64} alt={tutor.name} className="w-full h-full object-cover" />
            : initials(tutor.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Heading className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{tutor.name}</Heading>
            {tutor.tutorVerified && (
              <span className="text-xs font-bold px-3 py-1 rounded-full text-[var(--kin-chu-tren-nut-chinh)]"
                style={{ background: "var(--kin-tt-chu-xong)" }}>Đã xác minh</span>
            )}
            {/* PH-207/212: lời hứa của KiN với gia sư, nhìn thấy được trên hồ sơ chứ không chỉ nằm trong điều khoản */}
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>Không thu phí nhận lớp</span>
            {/* ĐX-05 (Q3): chỉ nói gia sư có ghi sổ gần đây — không phải nhãn chất lượng và không phải "đã xác minh" */}
            {stats.recentlyActive && (
              <span className="text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-tt-chu-xong)" }} data-testid="recently-active">
                <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--kin-tt-cham-xong)" }} />Có dạy trong 30 ngày qua
              </span>
            )}
          </div>
          {tutor.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tutor.subjects.map(s => (
                <span key={s} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" }}>{s}</span>
              ))}
            </div>
          )}

          {/* ĐX-06: khu vực và hình thức dạy — gia sư TỰ KHAI, KiN không xác minh. Chỉ quận/huyện, không địa chỉ nhà. Giá chỉ hiện khi gia sư tự bật. */}
          {hasPublicArea(tutor.area) && (
            <div className="mt-3 space-y-1.5" data-testid="tutor-area">
              {(tutor.area.city || tutor.area.district || tutor.area.mode) && (
                <div className="flex flex-wrap gap-1.5">
                  {(tutor.area.city || tutor.area.district) && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>{areaLine(tutor.area)}</span>
                  )}
                  {tutor.area.mode && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>{MODE_LABEL[tutor.area.mode]}</span>
                  )}
                </div>
              )}
              {tutor.area.credential && <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{tutor.area.credential} <span style={{ color: "var(--kin-chu-mo)" }}>(tự khai)</span></p>}
              {tutor.area.price !== null && <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{priceText(tutor.area.price)} <span className="text-xs font-normal" style={{ color: "var(--kin-chu-mo)" }}>· giá tham khảo</span></p>}
            </div>
          )}

          {/* FE-111: Bio đầy đủ (không line-clamp ở trang chi tiết). */}
          {tutor.bio && (
            <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{tutor.bio}</p>
          )}

          {/* FE-112: Stat thật (không hard-code) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { Icon: Star, value: avgText, label: stats.rating.total > 0 ? `${stats.rating.total} đánh giá` : "chưa có", color: "var(--kin-tt-chu-cho)" },
              { Icon: Users, value: stats.studentCount.toLocaleString(), label: "Học viên", color: "var(--kin-nhan-link)" },
              { Icon: BookOpen, value: stats.classCount, label: "Lớp đang dạy", color: "var(--kin-tt-chu-xong)" },
              { Icon: CalendarCheck, value: stats.sessionsTaught.toLocaleString(), label: "Buổi đã dạy (theo sổ lớp)", color: "var(--kin-nhan-link)" },
            ].map(({ Icon, value, label, color }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <Icon size={18} style={{ color, margin: "0 auto 4px" }} />
                <div className="font-extrabold text-base" style={{ color: "var(--kin-chu-chinh)" }}>{value}</div>
                <div className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
