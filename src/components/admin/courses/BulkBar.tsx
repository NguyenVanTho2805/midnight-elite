// CAT-02 — thanh ngữ cảnh khi chọn nhiều khoá: thay chỗ thanh lọc. Hiện · Ẩn · Đổi kỳ thi ▾ · Bỏ chọn. Vai gia sư không có "Đổi kỳ thi".
"use client";
import { KinButton, KIN_FIELD } from "@/components/kin";

export function BulkBar({ count, total, canCategory, categories, busy, onShow, onHide, onCategory, onClear, onSelectAll }: {
  count: number;
  /** Số khoá đang khớp bộ lọc (để mời "Chọn cả N khoá"). */
  total: number;
  canCategory: boolean;
  categories: string[];
  busy: boolean;
  onShow: () => void;
  onHide: () => void;
  onCategory: (name: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
}) {
  return (
    <div data-bulk-bar role="region" aria-label="Thao tác với các khoá đã chọn"
      className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-nhan)] px-4 py-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-medium text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" aria-live="polite">Đã chọn {count} khoá</p>
        <KinButton variant="secondary" loading={busy} loadingLabel="Đang lưu…" onClick={onShow}>Hiện</KinButton>
        <KinButton variant="secondary" loading={busy} loadingLabel="Đang lưu…" onClick={onHide}>Ẩn</KinButton>
        {canCategory && (
          <label className="inline-flex items-center">
            <span className="sr-only">Đổi kỳ thi cho các khoá đã chọn</span>
            <select disabled={busy} value="" onChange={e => { if (e.target.value) onCategory(e.target.value); }}
              className={`${KIN_FIELD} bg-[var(--kin-nen-trang)] w-auto pr-8`}>
              <option value="">Đổi kỳ thi ▾</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <KinButton variant="ghost" onClick={onClear}>Bỏ chọn</KinButton>
      </div>
      {count < total && (
        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
          Mới chọn {count}/{total} khoá khớp bộ lọc.{" "}
          <button type="button" onClick={onSelectAll} className="min-h-11 text-[var(--kin-nhan-link)] underline">Chọn cả {total} khoá</button>
        </p>
      )}
    </div>
  );
}
