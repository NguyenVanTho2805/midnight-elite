// BU-06 — nội dung bộ lọc, DÙNG CHUNG cột trái (máy tính) và tờ trượt (điện thoại).
// Chỉ là ô điều khiển; việc ghi vào URL hay giữ bản nháp do bên gọi. Số đếm lấy từ facets; mục count 0 mờ nhưng vẫn chọn được.
// Chọn một/hai trong "hình thức" và "đang hoạt động" là nút bật tắt (aria-pressed) cao ≥ 44px, không dùng ô tick nhỏ.
"use client";
import { useId } from "react";
import { demLoc, soVND, type BoLocState } from "./locUrl";
import type { TutorFacets } from "./kieu";
import { KinSelect } from "@/components/kin/KinSelect";

const SELECT = "min-h-[var(--kin-cham-toi-thieu)] w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";
const LABEL = "mb-1.5 block text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]";
const TOGGLE = "flex min-h-[var(--kin-cham-toi-thieu)] w-full items-center justify-between gap-2 rounded-[var(--kin-bo-md)] border px-3 text-left text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

// Chọn một trong danh sách ngắn (môn, lớp): dải nút bấm xuống dòng, thay ô thả xuống. Bấm lại mục đang chọn → về "Tất cả".
function ChipPicker({ label, allLabel, value, options, onPick }: { label: string; allLabel: string; value: string; options: { value: string; text: string }[]; onPick: (v: string) => void }) {
  const items = [{ value: "", text: allLabel }, ...options];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {items.map(o => {
        const on = value === o.value;
        return (
          <button key={o.value || "__all"} type="button" role="radio" aria-checked={on} onClick={() => onPick(on ? "" : o.value)}
            className="min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-tron)] border px-3.5 text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
            style={on ? { background: "var(--kin-nen-dang-chon)", borderColor: "var(--kin-nhan-nen)", color: "var(--kin-chu-chinh)", fontWeight: 600 } : { background: "var(--kin-nen-trang)", borderColor: "var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }}>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

function toggleStyle(on: boolean, dim: boolean) {
  return on
    ? { background: "var(--kin-nen-dang-chon)", borderColor: "var(--kin-nhan-nen)", color: "var(--kin-chu-chinh)" }
    : { background: "var(--kin-nen-trang)", borderColor: "var(--kin-vien-o-nhap)", color: dim ? "var(--kin-chu-mo)" : "var(--kin-chu-chinh)" };
}

export interface BoLocProps {
  value: BoLocState;
  onChange: (next: BoLocState) => void;
  facets: Partial<TutorFacets> | null;
  onClear?: () => void;
  /** Tiền tố id để hai bản (cột trái, tờ trượt) không trùng id. */
  idPrefix: string;
}

export function BoLoc({ value, onChange, facets, onClear, idPrefix }: BoLocProps) {
  const uid = useId();
  const id = (k: string) => `${idPrefix}-${uid}-${k}`;
  const set = (patch: Partial<BoLocState>) => onChange({ ...value, ...patch });
  const subjects = facets?.subjects ?? [];
  const grades = facets?.grades ?? [];
  const cities = facets?.cities ?? [];
  const districts = facets?.districts ?? [];
  const modes = facets?.modes;
  const price = facets?.price;
  // Giữ giá trị đang chọn trong danh sách kể cả khi facet không còn nó (để bỏ chọn được, không "mất" lựa chọn).
  const withCurrent = <T extends { value: string }>(list: T[], cur: string, make: (v: string) => T) => (cur && !list.some(x => x.value === cur) ? [make(cur), ...list] : list);
  const subjOpts = withCurrent(subjects, value.subject, v => ({ value: v, count: 0 }));
  const gradeOpts = withCurrent(grades, value.grade, v => ({ value: v, label: v, count: 0 }));
  const cityOpts = cities.includes(value.city) || !value.city ? cities : [value.city, ...cities];
  const distOpts = districts.includes(value.district) || !value.district ? districts : [value.district, ...districts];
  const n = demLoc(value) + (value.q.trim() ? 1 : 0);

  return (
    <div data-bo-loc className="flex flex-col gap-5">
      <div>
        <span className={LABEL}>Môn học</span>
        <ChipPicker label="Môn học" allLabel="Tất cả môn" value={value.subject} onPick={v => set({ subject: v })}
          options={subjOpts.map(s => ({ value: s.value, text: `${s.value}${s.count ? ` (${s.count})` : ""}` }))} />
      </div>
      <div>
        <span className={LABEL}>Lớp / cấp</span>
        <ChipPicker label="Lớp / cấp" allLabel="Tất cả lớp" value={value.grade} onPick={v => set({ grade: v })}
          options={gradeOpts.map(g => ({ value: g.value, text: `${g.label}${g.count ? ` (${g.count})` : ""}` }))} />
        <p className="mt-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Suy từ tên môn gia sư ghi (ví dụ &ldquo;Toán 9&rdquo;).</p>
      </div>
      <div>
        <label htmlFor={id("tinh")} className={LABEL}>Tỉnh / thành</label>
        <KinSelect id={id("tinh")} value={value.city} onChange={v => set({ city: v, district: "" })}>
          <option value="">Tất cả tỉnh / thành</option>
          {cityOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </KinSelect>
      </div>
      {value.city && (
        <div>
          <label htmlFor={id("quan")} className={LABEL}>Quận / huyện</label>
          <KinSelect id={id("quan")} value={value.district} onChange={v => set({ district: v })}>
            <option value="">Tất cả quận / huyện</option>
            {distOpts.map(d => <option key={d} value={d}>{d}</option>)}
          </KinSelect>
        </div>
      )}
      <fieldset className="m-0 border-0 p-0">
        <legend className={LABEL}>Hình thức</legend>
        <div className="flex flex-col gap-2">
          {([["online", "Online", modes?.online ?? 0], ["offline", "Dạy trực tiếp", modes?.offline ?? 0]] as const).map(([k, label, c]) => {
            const on = value.mode === k;
            return (
              <button key={k} type="button" aria-pressed={on} className={TOGGLE} style={toggleStyle(on, c === 0 && !on)}
                onClick={() => set({ mode: on ? "" : k })}>
                <span>{label}</span><span className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{c}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className={LABEL}>Giá tham khảo / buổi</legend>
        <div className="flex items-center gap-2">
          <input aria-label="Giá từ (đồng)" inputMode="numeric" autoComplete="off" placeholder="Từ" className={SELECT}
            value={soVND(value.priceMin)} onChange={e => set({ priceMin: e.target.value.replace(/\D+/g, "").slice(0, 8) })} />
          <span aria-hidden className="text-[var(--kin-chu-mo)]">–</span>
          <input aria-label="Giá đến (đồng)" inputMode="numeric" autoComplete="off" placeholder="Đến" className={SELECT}
            value={soVND(value.priceMax)} onChange={e => set({ priceMax: e.target.value.replace(/\D+/g, "").slice(0, 8) })} />
        </div>
        <p className="mt-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
          VND, do gia sư tự khai.{price?.min != null && price?.max != null && price.count > 0 && <> Đang có từ {price.min.toLocaleString("vi-VN")} đến {price.max.toLocaleString("vi-VN")}.</>} Gia sư không công khai giá sẽ không hiện khi lọc theo giá.
        </p>
      </fieldset>
      <button type="button" aria-pressed={value.active} className={TOGGLE} style={toggleStyle(value.active, (facets?.activeCount ?? 0) === 0 && !value.active)}
        onClick={() => set({ active: !value.active })}>
        <span>Chỉ gia sư đang hoạt động</span><span className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{facets?.activeCount ?? 0}</span>
      </button>
      {onClear && (
        <button type="button" onClick={onClear} disabled={n === 0}
          className="min-h-[var(--kin-cham-toi-thieu)] self-start rounded-[var(--kin-bo-md)] px-2 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
