// FE-157 — thẻ gia sư dùng chung (lưới /giang-vien và các nơi liệt kê gia sư). Tách nguyên văn từ trang danh sách, không đổi giao diện.
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/Button";
import { MODE_LABEL, areaLine, hasPublicArea, priceText, type PublicArea } from "@/lib/tutorArea";

export interface TutorListItem {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  studentCount: number;
  /** ĐX-00: số buổi ĐÃ DẠY theo sổ lớp (gia sư tự ghi, "ghi trên KiN"). */
  sessionsTaught: number;
  /** ĐX-05: có ít nhất 1 buổi đã dạy trong 30 ngày qua. */
  recentlyActive: boolean;
  /** ĐX-06: khu vực / hình thức / trường + bằng cấp (tự khai) / giá tham khảo (chỉ khi gia sư bật). null = chưa lưu mục này. */
  area?: PublicArea | null;
  rating: { avg: number | null; total: number };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TutorCard({ t }: { t: TutorListItem }) {
  // KH-02 (Figma 299:115283 / 299:116882): thẻ gọn trên nền sáng, không khung màu. Ảnh/chữ cái đầu, tên, môn · khu vực,
  // trường + bằng cấp (tự khai), hình thức · giá tham khảo (chỉ khi gia sư bật), vài con số tự động, MỘT nút chính "Xem hồ sơ".
  const area = hasPublicArea(t.area) ? t.area : null;
  const where = area ? areaLine(area) : "";
  const subjectLine = [t.subjects.join(", "), where].filter(Boolean).join(" · ");
  const modeLine = area ? [area.mode ? MODE_LABEL[area.mode] : "", area.price !== null ? `giá tham khảo ${priceText(area.price)}` : ""].filter(Boolean).join(" · ") : "";
  return (
    <article className="flex flex-col gap-4 py-5" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-start gap-4">
        <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-xl font-medium flex-shrink-0 overflow-hidden"
          style={{ background: "var(--kin-nen-dang-chon)", color: "var(--kin-th-navy)" }}>
          {t.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.avatarBase64} alt={t.name} className="w-full h-full object-cover" />
            : initials(t.name)}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[length:var(--kin-co-h4)] font-semibold leading-tight" style={{ color: "var(--kin-chu-chinh)" }}>{t.name}</h3>
            {t.tutorVerified && (
              <span className="text-[length:var(--kin-co-caption)] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>Đã xác minh</span>
            )}
          </div>
          {subjectLine && <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-chinh)" }} data-testid={where ? "tutor-area" : undefined}>{subjectLine}</p>}
        </div>
      </div>

      {t.bio && <p className="text-[length:var(--kin-co-small)] leading-relaxed line-clamp-2" style={{ color: "var(--kin-chu-phu)" }}>{t.bio}</p>}

      {/* ĐX-06: khu vực + hình thức là TỰ KHAI; giá chỉ khi gia sư tự bật */}
      {area && (area.city || area.district || area.mode || area.price !== null || area.credential) && (
        <div className="flex flex-col gap-1 text-[length:var(--kin-co-small)]" data-testid="tutor-area-detail">
          {area.credential && <p style={{ color: "var(--kin-chu-chinh)" }}>{area.credential} <span style={{ color: "var(--kin-chu-mo)" }}>(tự khai)</span></p>}
          {modeLine && <p style={{ color: "var(--kin-chu-mo)" }}>{modeLine}</p>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 m-0">
        <div className="flex flex-col gap-1">
          <dd className="text-lg m-0" style={{ color: "var(--kin-chu-chinh)" }}>{t.classCount}</dd>
          <dt className="text-[length:var(--kin-co-caption)] font-medium" style={{ color: "var(--kin-chu-mo)" }}>Lớp đang dạy</dt>
        </div>
        <div className="flex flex-col gap-1">
          <dd className="text-lg m-0" style={{ color: "var(--kin-chu-chinh)" }}>{t.studentCount}</dd>
          <dt className="text-[length:var(--kin-co-caption)] font-medium" style={{ color: "var(--kin-chu-mo)" }}>Học viên</dt>
        </div>
      </dl>

      {/* ĐX-05 (Q3): hai số tự động từ sổ lớp. Không có chữ "đã xác minh" vì gia sư tự ghi sổ. Số 0 thì không hiện để thẻ không nói điều tiêu cực về người mới. */}
      {(t.sessionsTaught > 0 || t.recentlyActive) && (
        <p className="text-[length:var(--kin-co-small)] flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--kin-chu-phu)" }} data-testid="tutor-activity">
          {t.sessionsTaught > 0 && <span>{t.sessionsTaught.toLocaleString("vi-VN")} buổi đã dạy</span>}
          {t.recentlyActive && (
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--kin-tt-chu-xong)" }}>
              <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--kin-tt-cham-xong)" }} />Có dạy trong 30 ngày qua
            </span>
          )}
        </p>
      )}

      <div className="flex">
        <Link href={`/mentor/${t.id}`} className={kinButtonClass("primary") + " flex-1 sm:flex-none"} aria-label={`Xem hồ sơ ${t.name}`}>Xem hồ sơ</Link>
      </div>
    </article>
  );
}

export function TutorCardSkeleton() {
  // FE-108: khung chờ khi đang tải — cùng dáng với thẻ mới (hàng không khung)
  return (
    <div className="py-5 flex flex-col gap-4" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-center gap-4">
        <div className="w-[52px] h-[52px] rounded-full animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-5 rounded animate-pulse w-1/3" style={{ background: "var(--kin-vien-thuong)" }} />
          <div className="h-3 rounded animate-pulse w-1/2" style={{ background: "var(--kin-nen-bang)" }} />
        </div>
      </div>
      <div className="h-11 w-28 rounded-lg animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />
    </div>
  );
}
