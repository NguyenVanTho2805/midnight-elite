// BU-06 — thẻ gia sư của lưới "Tìm gia sư" (1600: 4 cột, 390: 2 cột). Cả thẻ là MỘT liên kết tới hồ sơ.
// Không sao, không điểm; số về học sinh chỉ là số đếm; giá chỉ là giá tham khảo do gia sư tự khai và tự bật (không có giá ⇒ không in gì).
// TutorCard.tsx (phòng Gia sư) giữ nguyên; thẻ này là bản riêng cho sàn.
import Link from "next/link";
import { areaLine, hasPublicArea, priceText } from "@/lib/tutorArea";
import { initials } from "@/components/tutor/TutorCard";
import type { TutorListItem } from "./kieu";

const MON_TOI_DA = 3;

export function GiaSuCard({ t }: { t: TutorListItem }) {
  const area = hasPublicArea(t.area) ? t.area : null;
  const where = area ? areaLine(area) : "";
  const shown = t.subjects.slice(0, MON_TOI_DA);
  const more = t.subjects.length - shown.length;
  const stats = [
    t.sessionsTaught > 0 ? `${t.sessionsTaught.toLocaleString("vi-VN")} buổi đã dạy` : "",
    t.studentCount > 0 ? `${t.studentCount.toLocaleString("vi-VN")} học sinh đang dạy` : "",
  ].filter(Boolean).join(" · ");
  return (
    <article data-tutor-card className="min-w-0">
      <Link href={`/mentor/${t.id}`} aria-label={`Xem hồ sơ ${t.name}`}
        className="group flex h-full min-h-[var(--kin-cham-toi-thieu)] flex-col gap-3 overflow-hidden rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] transition-colors hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
        <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center text-4xl font-medium"
          style={{ background: "var(--kin-nen-dang-chon)", color: "var(--kin-th-navy)" }}>
          {t.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.avatarBase64} alt="" className="h-full w-full object-cover" />
            : <span aria-hidden>{initials(t.name)}</span>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-3 pb-3 sm:px-4 sm:pb-4">
          <h3 className="line-clamp-2 text-[length:var(--kin-co-body)] font-semibold leading-snug text-[var(--kin-chu-chinh)]">{t.name}</h3>
          {t.subjects.length > 0 && (
            <p className="line-clamp-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
              {shown.join(", ")}{more > 0 && <span className="text-[var(--kin-chu-mo)]"> +{more}</span>}
            </p>
          )}
          {area && area.price !== null && (
            <p data-tutor-price className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]">
              {priceText(area.price)} <span className="font-normal text-[var(--kin-chu-mo)]">· giá tham khảo</span>
            </p>
          )}
          {stats && <p data-tutor-stats className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-phu)]">{stats}</p>}
          {t.recentlyActive && (
            <p className="inline-flex items-center gap-1.5 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-tt-chu-xong)]">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--kin-tt-cham-xong)" }} />Hoạt động gần đây
            </p>
          )}
          {where && <p data-testid="tutor-area" className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{where}</p>}
        </div>
      </Link>
    </article>
  );
}

/** Khung chờ cùng dáng thẻ. */
export function GiaSuCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
      <div className="aspect-[4/3] w-full animate-pulse" style={{ background: "var(--kin-vien-nhat)" }} />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-4 w-3/4 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ background: "var(--kin-vien-thuong)" }} />
        <div className="h-3 w-1/2 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ background: "var(--kin-vien-nhat)" }} />
        <div className="h-3 w-2/3 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ background: "var(--kin-vien-nhat)" }} />
      </div>
    </div>
  );
}
