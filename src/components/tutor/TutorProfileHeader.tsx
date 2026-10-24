// FE-158 — đầu hồ sơ gia sư dùng chung: ảnh, tên, nhãn tin cậy, môn dạy, giới thiệu, bốn con số.
// Dùng ở hồ sơ công khai /mentor/[id] và ở bản xem trước trong Hồ sơ gia sư (Dashboard). Tách nguyên văn từ trang hồ sơ, không đổi giao diện.
import { initials } from "@/components/tutor/TutorCard";
import { MODE_LABEL, areaLine, hasPublicArea, priceText, type PublicArea } from "@/lib/tutorArea";

export interface ProfileHeaderTutor { name: string; avatarBase64: string | null; bio: string | null; subjects: string[]; tutorVerified: boolean; /** ĐX-06: khu vực / hình thức / trường + bằng cấp / giá tham khảo, TỰ KHAI. */ area?: PublicArea | null }
export interface ProfileHeaderStats { classCount: number; studentCount: number; sessionsTaught: number; /** ĐX-05: có ít nhất 1 buổi đã dạy trong 30 ngày qua. */ recentlyActive?: boolean; rating: { avg: number | null; total: number } }

/** `as`: cấp tiêu đề của tên gia sư — "h1" ở trang hồ sơ công khai, "h2" khi nhúng vào trang đã có h1 (xem trước ở Hồ sơ gia sư). */
export default function TutorProfileHeader({ tutor, stats, as: Heading = "h1" }: { tutor: ProfileHeaderTutor; stats: ProfileHeaderStats; as?: "h1" | "h2" }) {
  // KH-03 (Figma 299:115452): nền sáng, không khung. Tên + nhãn, môn · khu vực, giới thiệu, rồi một hàng số liệu tự động (chỉ đọc).
  const numbers: { value: string; label: string }[] = [
    { value: stats.classCount.toLocaleString("vi-VN"), label: "Lớp đang dạy" },
    { value: stats.studentCount.toLocaleString("vi-VN"), label: "Học viên" },
    { value: stats.sessionsTaught.toLocaleString("vi-VN"), label: "Buổi đã dạy (theo sổ lớp)" },
  ];
  // Không có đánh giá thì không hiện ô "—": chỉ hiện khi đã có đánh giá thật.
  if (stats.rating.avg !== null && stats.rating.total > 0) numbers.push({ value: stats.rating.avg.toFixed(1), label: `${stats.rating.total} đánh giá` });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium flex-shrink-0 overflow-hidden"
          style={{ background: "var(--kin-nen-dang-chon)", color: "var(--kin-th-navy)" }}>
          {tutor.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={tutor.avatarBase64} alt={tutor.name} className="w-full h-full object-cover" />
            : initials(tutor.name)}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Heading className="text-[length:var(--kin-co-h3)] sm:text-[length:var(--kin-co-h2)] font-semibold leading-tight" style={{ color: "var(--kin-chu-chinh)" }}>{tutor.name}</Heading>
            {tutor.tutorVerified && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>Đã duyệt hồ sơ</span>
            )}
            {/* PH-207/212: lời hứa của KiN với gia sư, nhìn thấy được trên hồ sơ chứ không chỉ nằm trong điều khoản */}
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>Không thu phí nhận lớp</span>
            {/* ĐX-05 (Q3): chỉ nói gia sư có ghi sổ gần đây — không phải nhãn chất lượng và không phải "đã xác minh" */}
            {stats.recentlyActive && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-tt-chu-xong)" }} data-testid="recently-active">
                <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--kin-tt-cham-xong)" }} />Có dạy trong 30 ngày qua
              </span>
            )}
          </div>
          {tutor.subjects.length > 0 && (
            <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
              {tutor.subjects.join(" · ")}
            </p>
          )}

          {/* ĐX-06: khu vực và hình thức dạy — gia sư TỰ KHAI, KiN không xác minh. Chỉ quận/huyện, không địa chỉ nhà. Giá chỉ hiện khi gia sư tự bật. */}
          {hasPublicArea(tutor.area) && (
            <div className="space-y-1" data-testid="tutor-area">
              {(tutor.area.city || tutor.area.district || tutor.area.mode) && (
                <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-phu)" }}>
                  {[(tutor.area.city || tutor.area.district) ? areaLine(tutor.area) : "", tutor.area.mode ? MODE_LABEL[tutor.area.mode] : ""].filter(Boolean).join(" · ")}
                </p>
              )}
              {tutor.area.credential && <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-phu)" }}>{tutor.area.credential} <span style={{ color: "var(--kin-chu-mo)" }}>(tự khai)</span></p>}
              {tutor.area.price !== null && <p className="text-[length:var(--kin-co-small)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{priceText(tutor.area.price)} <span className="font-normal" style={{ color: "var(--kin-chu-mo)" }}>· giá tham khảo</span></p>}
            </div>
          )}
        </div>
      </div>

      {/* FE-112: số liệu thật, tự động, chỉ đọc (không hard-code) */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 py-5 m-0" style={{ borderTop: "1px solid var(--kin-vien-thuong)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        {numbers.map(n => (
          <div key={n.label} className="flex flex-col gap-1">
            <dd className="text-[22px] leading-tight m-0" style={{ color: "var(--kin-chu-chinh)" }}>{n.value}</dd>
            <dt className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>{n.label}</dt>
          </div>
        ))}
      </dl>

      {/* FE-111: Bio đầy đủ (không line-clamp ở trang chi tiết). */}
      {tutor.bio && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[length:var(--kin-co-body)] font-semibold pb-2.5" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>Giới thiệu</h2>
          <p className="text-[length:var(--kin-co-body)] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--kin-chu-chinh)" }}>{tutor.bio}</p>
        </section>
      )}
    </div>
  );
}
