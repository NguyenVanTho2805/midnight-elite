// LOI-05 mục 4.1 — ba ô lọc tối giản: Môn, Khu vực (thành phố), Hình thức (Tất cả · Online · Dạy trực tiếp).
// Dùng chung cho hàng lọc ngang (≥ md) và tờ trượt (điện thoại). Chỉ là ô điều khiển: ghi URL hay giữ bản nháp là việc của bên gọi.
// Danh sách chọn lấy từ facet của API; giá trị đang chọn luôn còn trong danh sách (để bỏ chọn được) kể cả khi facet không còn nó.
"use client";
import { useId } from "react";
import { KinButton } from "@/components/kin/Button";
import type { SanLoc } from "@/lib/tutorFloorFilter";
import type { TutorFacets } from "@/components/tutor/tim-gia-su/kieu";

export const O_CHON = "min-h-[var(--kin-cham-toi-thieu)] w-full min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";
const NHAN = "mb-1.5 block text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]";
const AN = "sr-only";

const HINH_THUC: { value: SanLoc["mode"]; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Dạy trực tiếp" },
];

export function BoChonLoc({ value, onChange, facets, kieu }: {
  value: SanLoc;
  onChange: (next: SanLoc) => void;
  facets: Partial<TutorFacets> | null;
  /** "hang": hàng ngang trên lưới (nhãn ẩn, đọc được bằng trình đọc màn hình). "to": tờ trượt (nhãn hiện, xếp dọc). */
  kieu: "hang" | "to";
}) {
  const uid = useId();
  const set = (patch: Partial<SanLoc>) => onChange({ ...value, ...patch });
  const subjects = (facets?.subjects ?? []).map(s => s.value);
  const cities = facets?.cities ?? [];
  const giu = (list: string[], cur: string) => (cur && !list.includes(cur) ? [cur, ...list] : list);
  const hang = kieu === "hang";
  const nhan = hang ? AN : NHAN;

  return (
    <div data-bo-chon-loc={kieu} className={hang ? "contents" : "flex flex-col gap-5"}>
      <div className={hang ? "w-full min-w-0 md:w-[220px]" : ""}>
        <label htmlFor={`${uid}-mon`} className={nhan}>Môn</label>
        <select id={`${uid}-mon`} className={O_CHON} value={value.subject} onChange={e => set({ subject: e.target.value })}>
          <option value="">Tất cả môn</option>
          {giu(subjects, value.subject).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className={hang ? "w-full min-w-0 md:w-[220px]" : ""}>
        <label htmlFor={`${uid}-khu-vuc`} className={nhan}>Khu vực</label>
        <select id={`${uid}-khu-vuc`} className={O_CHON} value={value.city} onChange={e => set({ city: e.target.value })}>
          <option value="">Mọi khu vực</option>
          {giu(cities, value.city).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className={nhan}>Hình thức dạy</legend>
        <div className="flex gap-2">
          {HINH_THUC.map(o => {
            const on = value.mode === o.value;
            return (
              <KinButton key={o.value || "tat-ca"} type="button" variant="secondary" aria-pressed={on} onClick={() => set({ mode: o.value })}
                className={hang ? "" : "flex-1 px-2"}
                style={on ? { background: "var(--kin-nen-dang-chon)", borderColor: "var(--kin-nhan-nen)", fontWeight: 600 } : undefined}>
                {o.label}
              </KinButton>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
