// CAT-02 — bảng khoá học: ô chọn + 6 cột (Khoá học · Trạng thái · Sĩ số · Kỳ thi · Giá · Mở). Cột đầu là TÊN khoá (định danh).
// Dưới 768px mỗi khoá là thẻ-hàng. Mỗi hàng chỉ có 2 điều khiển (nút tên mở panel + liên kết "Mở") ngoài ô chọn.
// Giá chỉ HIỂN THỊ từ API, không sửa, không tính.
"use client";
import Link from "next/link";
import { KinStatus, KIN_TABLE_HEAD, KIN_TABLE_ROW, type StatusTone } from "@/components/kin";
import type { CatalogRow } from "./CourseFilters";

const COLS = "md:grid-cols-[44px_minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_64px]";

const CLASS_LABEL: Record<CatalogRow["classStatus"], { tone: StatusTone; text: string }> = {
  open: { tone: "xong", text: "Đang nhận" },
  closed: { tone: "mo", text: "Đã đóng" },
  paused: { tone: "cho", text: "Tạm ngừng" },
};

export function formatPrice(p: number): string {
  return p === 0 ? "Miễn phí" : `${p.toLocaleString("vi-VN")}đ`;
}
export function seats(r: CatalogRow): string {
  return r.capacity == null ? `${r.enrolled} · không giới hạn` : `${r.enrolled}/${r.capacity}`;
}
export const isFull = (r: CatalogRow) => r.capacity != null && r.enrolled >= r.capacity;

export function CourseTable({ rows, selected, onToggle, onToggleAll, onOpen, activeId, busyIds, refreshing, hrefFor }: {
  rows: CatalogRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (id: string) => void;
  activeId: string | null;
  busyIds: Set<string>;
  refreshing?: boolean;
  hrefFor: (adminPath: string) => string;
}) {
  const allOn = rows.length > 0 && rows.every(r => selected.has(r.id));
  const someOn = !allOn && rows.some(r => selected.has(r.id));
  const check = "w-5 h-5 accent-[var(--kin-nhan-nen)]";
  return (
    <div data-course-table aria-busy={refreshing || undefined} className="relative">
      {refreshing && <div aria-hidden data-table-refresh className="absolute inset-x-0 top-0 h-0.5 bg-[var(--kin-nhan-nen)] animate-pulse" />}
      <div role="row" className={`hidden md:grid ${COLS} gap-x-4 ${KIN_TABLE_HEAD}`}>
        <label className="inline-flex items-center justify-center w-11 h-11 -ml-3 cursor-pointer">
          <span className="sr-only">Chọn các khoá đang hiện</span>
          <input type="checkbox" className={check} checked={allOn}
            ref={el => { if (el) el.indeterminate = someOn; }}
            onChange={e => onToggleAll(e.target.checked)} />
        </label>
        <span>Khoá học</span><span>Trạng thái</span><span>Sĩ số</span><span>Kỳ thi</span><span className="text-right">Giá</span><span />
      </div>
      <ul>
        {rows.map(r => {
          const cls = CLASS_LABEL[r.classStatus] ?? CLASS_LABEL.open;
          const active = activeId === r.id;
          return (
            <li key={r.id} data-course-row={r.id} data-selected={selected.has(r.id) || undefined}
              className={`grid grid-cols-[44px_minmax(0,1fr)] ${COLS} gap-x-3 md:gap-x-4 gap-y-1 ${KIN_TABLE_ROW} ${active ? "bg-[var(--kin-nen-dang-chon)]" : selected.has(r.id) ? "bg-[var(--kin-nen-nhan)]" : "hover:bg-[var(--kin-nen-re-chuot)]"} ${busyIds.has(r.id) ? "opacity-60" : ""}`}>
              <label className="row-span-3 md:row-span-1 inline-flex items-start md:items-center justify-center w-11 h-11 -ml-3 -mt-1 md:mt-0 cursor-pointer">
                <span className="sr-only">Chọn {r.name}</span>
                <input type="checkbox" className={check} checked={selected.has(r.id)} onChange={() => onToggle(r.id)} />
              </label>
              <div className="min-w-0">
                <button type="button" onClick={() => onOpen(r.id)} aria-label={`Sửa nhanh: ${r.name}`}
                  className="block w-full min-h-11 md:min-h-0 text-left font-medium text-[var(--kin-chu-chinh)] truncate hover:underline focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
                  {r.name}
                </button>
                <p className="text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)] truncate">{r.tutor.name} · {r.id}</p>
              </div>
              <div className="col-start-2 md:col-start-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                <KinStatus tone={r.status ? "xong" : "mo"}>{r.status ? "Đang hiển thị" : "Đang ẩn"}</KinStatus>
                <KinStatus tone={cls.tone}>{cls.text}</KinStatus>
              </div>
              <div className="col-start-2 md:col-start-auto flex flex-wrap items-center gap-x-2 text-[var(--kin-chu-phu)] tabular-nums">
                <span><span className="md:hidden text-[var(--kin-chu-mo)]">Sĩ số </span>{seats(r)}</span>
                {isFull(r) && <KinStatus tone="cho">Đầy</KinStatus>}
              </div>
              <p className="hidden md:block truncate text-[var(--kin-chu-phu)]">{r.category}</p>
              <p className="col-start-2 md:col-start-auto md:text-right tabular-nums text-[var(--kin-chu-chinh)]">
                <span className="md:hidden text-[var(--kin-chu-mo)]">{r.category} · </span>{formatPrice(r.price)}
              </p>
              <Link href={hrefFor(`/admin/khoa-hoc/${r.id}`)} aria-label={`Mở ${r.name}`}
                className="col-start-2 md:col-start-auto inline-flex items-center md:justify-end min-h-11 text-[var(--kin-nhan-link)] hover:underline">
                Mở
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
