// BU-06 — đầu hồ sơ công khai: ảnh bìa 16:9 (nếu có) rồi hàng avatar + tên + nhãn + môn · khu vực.
// Không có ảnh bìa ⇒ khối nền nhạt + avatar lớn, KHÔNG dùng ảnh giả. coverUrl chỉ là data URL đã được máy chủ kiểm (isValidCover) và không bao giờ vào OG.
import { areaLine, hasPublicArea } from "@/lib/tutorArea";
import { initials } from "@/components/tutor/TutorCard";
import type { TutorDetailResponse } from "./kieu";

export function DauHoSo({ tutor }: { tutor: TutorDetailResponse["tutor"] }) {
  const area = hasPublicArea(tutor.area) ? tutor.area : null;
  const where = area ? areaLine(area) : "";
  const avatar = (size: string, text: string) => (
    <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium ${text}`} style={{ background: "var(--kin-nen-dang-chon)", color: "var(--kin-th-navy)" }}>
      {tutor.avatarBase64
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={tutor.avatarBase64} alt={tutor.name} className="h-full w-full object-cover" />
        : <span aria-hidden>{initials(tutor.name)}</span>}
    </div>
  );
  return (
    <header className="flex flex-col gap-4" data-ho-so-dau>
      {tutor.coverUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)]" data-cover>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tutor.coverUrl} alt={`Ảnh bìa hồ sơ của ${tutor.name}`} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/6] w-full items-center justify-center rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-nhat)]" style={{ background: "var(--kin-nen-bang)" }} data-cover-empty>
          {avatar("h-24 w-24", "text-3xl")}
        </div>
      )}
      <div className="flex items-center gap-4">
        {tutor.coverUrl && avatar("h-16 w-16", "text-xl")}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[length:var(--kin-co-h3)] font-semibold leading-tight text-[var(--kin-chu-chinh)] lg:text-[length:var(--kin-co-h2)]">{tutor.name}</h1>
            {tutor.tutorVerified && (
              <span className="rounded-full border border-[var(--kin-vien-thuong)] px-2 py-0.5 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-chu-phu)]" style={{ background: "var(--kin-nen-bang)" }}>Đã duyệt hồ sơ</span>
            )}
          </div>
          {(tutor.subjects.length > 0 || where) && (
            <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]" data-testid={where ? "tutor-area" : undefined}>
              {[tutor.subjects.join(", "), where].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
