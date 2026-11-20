// LOI-05 mục 4.3 — đầu hồ sơ công khai: ảnh bìa 16:6 (CHỈ khi có — không khối giả), ảnh tròn 128px (điện thoại 96px) hoặc chữ cái đầu,
// TÊN ĐẦY ĐỦ (H1, xuống dòng, không cắt), chip môn, nhãn–giá trị Cấp lớp · Khu vực · Hình thức · Trường/bằng cấp (tự khai). Thiếu trường nào thì bỏ dòng đó.
// Không nhãn "Đã duyệt hồ sơ" (mọi hồ sơ công khai đều đã duyệt; tránh bị hiểu là đã xác minh thông tin tự khai).
import { areaLine, hasPublicArea, MODE_LABEL } from "@/lib/tutorArea";
import { gradeLine } from "@/lib/tutorCardView";
import type { TutorDetailResponse } from "@/components/tutor/tim-gia-su/kieu";
import { AnhGiaSu } from "./AnhGiaSu";

export const tenDayDu = (name: string) => name.trim().replace(/\s+/g, " ");

export function DauHoSo({ tutor }: { tutor: TutorDetailResponse["tutor"] }) {
  const name = tenDayDu(tutor.name);
  const area = hasPublicArea(tutor.area) ? tutor.area : null;
  const rows: { label: string; value: string; key: string }[] = [
    { label: "Cấp lớp", value: gradeLine(tutor.subjects), key: "cap-lop" },
    { label: "Khu vực", value: area ? areaLine(area) : "", key: "khu-vuc" },
    { label: "Hình thức", value: area?.mode ? MODE_LABEL[area.mode] : "", key: "hinh-thuc" },
    { label: "Trường / bằng cấp (tự khai)", value: area?.credential ?? "", key: "bang-cap" },
  ].filter(r => r.value);

  return (
    <header className="flex flex-col gap-5" data-ho-so-dau>
      {tutor.coverUrl && (
        <div className="aspect-[16/6] w-full overflow-hidden rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)]" data-cover>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tutor.coverUrl} alt={`Ảnh bìa hồ sơ của ${name}`} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <AnhGiaSu name={name} src={tutor.avatarBase64} alt={`Ảnh của ${name}`} className="h-24 w-24 sm:h-32 sm:w-32" chuClass="text-[length:var(--kin-co-h2)]" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 data-ten-gia-su className="m-0 break-words [overflow-wrap:anywhere] text-[length:var(--kin-co-h3)] font-semibold leading-tight text-[var(--kin-chu-chinh)] lg:text-[length:var(--kin-co-h2)]">{name}</h1>
          {tutor.subjects.length > 0 && (
            <ul aria-label="Môn dạy" className="m-0 flex list-none flex-wrap gap-2 p-0" data-mon-ho-so>
              {tutor.subjects.map(s => (
                <li key={s} className="break-words rounded-[var(--kin-bo-tron)] border border-[var(--kin-vien-thuong)] px-3 py-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{s}</li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 text-[length:var(--kin-co-goc)] leading-5 sm:grid-cols-[11rem_minmax(0,1fr)]" data-tutor-area-detail>
              {rows.map(r => (
                <div key={r.key} className="contents">
                  <dt className="text-[var(--kin-chu-mo)] max-sm:mt-1">{r.label}</dt>
                  <dd className="m-0 break-words text-[var(--kin-chu-chinh)]" data-testid={r.key === "khu-vuc" ? "tutor-area" : undefined}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </header>
  );
}
