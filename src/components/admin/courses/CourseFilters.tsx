// CAT-02 — thanh công cụ danh sách khoá: ô tìm + bốn bộ lọc + sắp xếp + chip đang lọc. Trạng thái lọc sống ở URL (?q=&kythi=&tt=&giasu=&gia=&sx=).
// Kiểu hàng, lọc và facet dùng thư viện thuần src/lib/courseCatalogAdmin.ts (chung với máy chủ + test); ở đây chỉ thêm lớp URL và sắp xếp.
"use client";
import { useState } from "react";
import { KIN_FIELD, KinButton } from "@/components/kin";
import { buildFacets, filterRows, type CatalogFacets, type CatalogRow } from "@/lib/courseCatalogAdmin";
import { KinSelect } from "@/components/kin/KinSelect";

export { buildFacets };
export type { CatalogRow, CatalogFacets };

export interface CatalogFilter { q: string; kythi: string; tt: "" | "hien" | "an"; giasu: string; gia: "" | "mien-phi" | "co-phi"; sx: "" | "ten" | "dong" | "thu-tu" }
export const EMPTY_FILTER: CatalogFilter = { q: "", kythi: "", tt: "", giasu: "", gia: "", sx: "" };
export const TUTOR_CENTER = "trung-tam";


export function readFilter(sp: { get(k: string): string | null }): CatalogFilter {
  const tt = sp.get("tt"), gia = sp.get("gia"), sx = sp.get("sx");
  return {
    q: sp.get("q") ?? "",
    kythi: sp.get("kythi") ?? sp.get("category") ?? "",
    tt: tt === "hien" || tt === "an" ? tt : "",
    giasu: sp.get("giasu") ?? "",
    gia: gia === "mien-phi" || gia === "co-phi" ? gia : "",
    sx: sx === "ten" || sx === "dong" || sx === "thu-tu" ? sx : "",
  };
}
export function filterToQuery(f: CatalogFilter): string {
  const p = new URLSearchParams();
  (Object.keys(f) as (keyof CatalogFilter)[]).forEach(k => { if (f[k]) p.set(k, f[k]); });
  return p.toString();
}
export function activeCount(f: CatalogFilter): number {
  return [f.kythi, f.tt, f.giasu, f.gia].filter(Boolean).length;
}

export function applyFilter(rows: CatalogRow[], f: CatalogFilter): CatalogRow[] {
  const out = filterRows(rows, {
    q: f.q,
    category: f.kythi,
    tutor: f.giasu === TUTOR_CENTER ? "center" : f.giasu || undefined,
    visibility: f.tt === "hien" ? "shown" : f.tt === "an" ? "hidden" : undefined,
    fee: f.gia === "mien-phi" ? "free" : f.gia === "co-phi" ? "paid" : undefined,
  });
  if (f.sx === "ten") return [...out].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  if (f.sx === "dong") return [...out].sort((a, b) => b.enrolled - a.enrolled);
  if (f.sx === "thu-tu") return out; // thứ tự máy chủ trả
  return [...out].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

const SORT_LABEL: Record<string, string> = { "": "Mới tạo", ten: "Tên A–Z", dong: "Đông học viên nhất", "thu-tu": "Thứ tự trang công khai" };

export function CourseFilters({ value, onChange, facets, showTutor, disabled, onReload, reloading, hidden }: {
  value: CatalogFilter;
  onChange: (next: CatalogFilter) => void;
  facets: CatalogFacets;
  showTutor: boolean;
  disabled?: boolean;
  onReload: () => void;
  reloading?: boolean;
  /** Đang chọn nhiều: thanh lọc nhường chỗ cho BulkBar. */
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const n = activeCount(value);
  const set = <K extends keyof CatalogFilter>(k: K, v: CatalogFilter[K]) => onChange({ ...value, [k]: v });
  const chips: { key: keyof CatalogFilter; text: string }[] = [];
  if (value.q.trim()) chips.push({ key: "q", text: `Tìm: “${value.q.trim()}”` });
  if (value.kythi) chips.push({ key: "kythi", text: `Kỳ thi: ${value.kythi}` });
  if (value.tt) chips.push({ key: "tt", text: value.tt === "hien" ? "Đang hiển thị" : "Đang ẩn" });
  if (value.giasu) chips.push({ key: "giasu", text: `Gia sư: ${facets.tutors.find(t => (t.id ?? TUTOR_CENTER) === value.giasu)?.name ?? value.giasu}` });
  if (value.gia) chips.push({ key: "gia", text: value.gia === "mien-phi" ? "Miễn phí (giá 0)" : "Có phí" });

  return (
    <div data-course-filters>
      {!hidden && (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="cf-q" className="sr-only">Tìm khoá học theo tên hoặc mã</label>
              <input
                id="cf-q" type="search" inputMode="search" disabled={disabled}
                placeholder="Tìm theo tên khoá hoặc mã"
                value={value.q} onChange={e => set("q", e.target.value)}
                className={KIN_FIELD}
              />
            </div>
            <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} disabled={disabled}
              className="md:hidden min-h-11 px-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] bg-[var(--kin-nen-trang)] whitespace-nowrap">
              {n > 0 ? `Lọc (${n})` : "Lọc"}
            </button>
            <button type="button" onClick={onReload} disabled={disabled || reloading} aria-label="Tải lại danh sách"
              className="min-h-11 px-3 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:bg-[var(--kin-nen-re-chuot)] whitespace-nowrap">
              {reloading ? "Đang tải…" : "Tải lại"}
            </button>
          </div>
          <div className={`${open ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3`}>
            <label className="min-w-0"><span className="sr-only">Kỳ thi</span>
              <KinSelect disabled={disabled} value={value.kythi} onChange={v => set("kythi", v)}>
                <option value="">Kỳ thi: tất cả</option>
                {facets.categories.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
              </KinSelect></label>
            <label className="min-w-0"><span className="sr-only">Trạng thái</span>
              <KinSelect disabled={disabled} value={value.tt} onChange={v => set("tt", v as CatalogFilter["tt"])}>
                <option value="">Trạng thái: tất cả</option>
                <option value="hien">Đang hiển thị ({facets.shown})</option>
                <option value="an">Đang ẩn ({facets.hidden})</option>
              </KinSelect></label>
            {showTutor && (
              <label className="min-w-0"><span className="sr-only">Gia sư</span>
                <KinSelect disabled={disabled} value={value.giasu} onChange={v => set("giasu", v)}>
                  <option value="">Gia sư: tất cả</option>
                  {facets.tutors.map(t => <option key={t.id ?? TUTOR_CENTER} value={t.id ?? TUTOR_CENTER}>{t.id ? t.name : "Trung tâm"} ({t.count})</option>)}
                </KinSelect></label>
            )}
            <label className="min-w-0"><span className="sr-only">Giá</span>
              <KinSelect disabled={disabled} value={value.gia} onChange={v => set("gia", v as CatalogFilter["gia"])}>
                <option value="">Giá: tất cả</option>
                <option value="mien-phi">Miễn phí (giá 0)</option>
                <option value="co-phi">Có phí</option>
              </KinSelect></label>
            <label className="min-w-0"><span className="sr-only">Sắp xếp</span>
              <KinSelect disabled={disabled} value={value.sx} onChange={v => set("sx", v as CatalogFilter["sx"])}>
                {Object.entries(SORT_LABEL).map(([k, v]) => <option key={k} value={k}>Sắp xếp: {v}</option>)}
              </KinSelect></label>
          </div>
        </div>
      )}
      {chips.length > 0 && (
        <div data-filter-chips className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map(c => (
            <span key={c.key} className="inline-flex items-center gap-1 pl-3 rounded-[var(--kin-bo-tron)] bg-[var(--kin-nen-nhan)] text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-chu-tren-nhat)]">
              {c.text}
              <button type="button" aria-label={`Bỏ lọc ${c.text}`} onClick={() => set(c.key, "" as never)}
                className="w-11 h-11 -my-2 inline-flex items-center justify-center rounded-[var(--kin-bo-tron)]">✕</button>
            </span>
          ))}
          <KinButton variant="ghost" onClick={() => onChange({ ...EMPTY_FILTER, sx: value.sx })}>Xoá bộ lọc</KinButton>
        </div>
      )}
    </div>
  );
}
