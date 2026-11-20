// LOI-05 mục 4.2 — thẻ gia sư của trang Tìm gia sư. Lời chủ: "ô gia sư quá bé, không show được ảnh, thông tin; họ tên thiếu, mất cả chữ".
// Ảnh tròn 88px (điện thoại) / 96px (≥ lg) + TÊN ĐẦY ĐỦ (xuống dòng tự nhiên, không bao giờ cắt) + môn; thân là nhãn–giá trị chỉ cho dòng có dữ liệu;
// đáy là nút "Xem hồ sơ" full bề ngang, dính đáy để thẻ cùng hàng cao bằng nhau.
// Không sao/điểm/"đã xác minh"; trường `rating` của API không được vẽ. Giá chỉ khi gia sư tự bật, luôn kèm "tự khai" (tutorCardView lo).
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { tutorCardView } from "@/lib/tutorCardView";
import type { TutorListItem } from "@/components/tutor/tim-gia-su/kieu";
import { AnhGiaSu } from "./AnhGiaSu";

const THE = "flex h-full min-w-0 flex-col gap-4 rounded-[var(--kin-bo-lg)] border bg-[var(--kin-nen-trang)] p-5";

export function TheGiaSu({ t }: { t: TutorListItem }) {
  const v = tutorCardView(t);
  const href = `/mentor/${encodeURIComponent(v.id)}`;
  const rows: { label: string; value: string; key: string }[] = [
    { label: "Cấp lớp", value: v.gradeLine, key: "cap-lop" },
    { label: "Khu vực", value: v.areaLine, key: "khu-vuc" },
    { label: "Hình thức", value: v.modeLabel, key: "hinh-thuc" },
    { label: "Giá", value: v.priceLine, key: "gia" },
  ].filter(r => r.value);

  return (
    <article data-the-gia-su={v.id} className={`${THE} border-[var(--kin-vien-thuong)]`}>
      <div className="flex items-start gap-4">
        <AnhGiaSu name={v.name} src={v.avatar} className="h-[88px] w-[88px] lg:h-24 lg:w-24" chuClass="text-[length:var(--kin-co-h3)]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 data-ten-gia-su className="m-0 break-words text-[length:var(--kin-co-h4)] font-semibold leading-snug text-[var(--kin-chu-chinh)]">
            <Link href={href}
              className="flex min-h-[var(--kin-cham-toi-thieu)] items-center break-words [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
              {v.name}
            </Link>
          </h3>
          {v.subjects.length > 0 && (
            <p data-mon-the className="m-0 break-words text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
              {v.subjects.join(" · ")}
              {v.moreSubjects > 0 && <span className="text-[var(--kin-chu-mo)]"> +{v.moreSubjects} môn</span>}
            </p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="m-0 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[length:var(--kin-co-goc)] leading-5">
          {rows.map(r => (
            <div key={r.key} className="contents" data-dong-the={r.key}>
              <dt className="text-[var(--kin-chu-mo)]">{r.label}</dt>
              <dd className="m-0 break-words text-[var(--kin-chu-chinh)]" data-testid={r.key === "khu-vuc" ? "tutor-area" : undefined}>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Cắt hai dòng CÓ CHỦ Ý ở phần giới thiệu (đầy đủ ở hồ sơ). Tên thì không bao giờ cắt. */}
      {v.bio && <p data-gioi-thieu className="m-0 line-clamp-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">{v.bio}</p>}

      <div className="mt-auto pt-1">
        <Link href={href} aria-label={`Xem hồ sơ ${v.name}`} className={`${kinButtonClass("secondary")} w-full`}>Xem hồ sơ</Link>
      </div>
    </article>
  );
}

/** Khung chờ cùng dáng thẻ (ảnh tròn, hai dòng tên/môn, ba dòng nhãn, nút). */
export function TheGiaSuCho() {
  return (
    <div aria-hidden data-the-gia-su-cho className={`${THE} border-[var(--kin-vien-nhat)]`}>
      <div className="flex items-start gap-4">
        <div className="h-[88px] w-[88px] shrink-0 animate-pulse rounded-full lg:h-24 lg:w-24" style={{ background: "var(--kin-vien-nhat)" }} />
        <div className="flex flex-1 flex-col gap-2 pt-3">
          <div className="h-5 w-4/5 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ background: "var(--kin-vien-thuong)" }} />
          <div className="h-4 w-1/2 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ background: "var(--kin-vien-nhat)" }} />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {[70, 55, 62].map(w => <div key={w} className="h-4 animate-pulse rounded-[var(--kin-bo-tron)]" style={{ width: `${w}%`, background: "var(--kin-vien-nhat)" }} />)}
      </div>
      <div className="mt-auto h-[var(--kin-cham-toi-thieu)] animate-pulse rounded-[var(--kin-bo-md)]" style={{ background: "var(--kin-vien-nhat)" }} />
    </div>
  );
}
