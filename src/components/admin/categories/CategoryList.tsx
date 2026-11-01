// CAT-02 — danh sách danh mục có THỨ TỰ: kéo thả (chuột), Alt+↑/↓ trên nút tên (bàn phím), hoặc Lên/Xuống trong panel.
// Cột đầu là tên danh mục (định danh). Mỗi hàng 2 điều khiển: nút tên (mở panel) + liên kết "Xem khoá".
// Vai gia sư: chỉ đọc (không kéo, không panel).
"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  total: number;
  shown: number;
  hidden: number;
}

const COLS = "md:grid-cols-[32px_minmax(0,2fr)_minmax(0,2fr)_96px]";

export function courseCountText(c: CategoryRow, readOnly: boolean): string {
  return readOnly ? `${c.total} khoá của bạn` : `${c.total} khoá · ${c.shown} hiển thị · ${c.hidden} ẩn`;
}

export function CategoryList({ rows, readOnly, activeId, onOpen, onMove, onReorder, saving, hrefFor }: {
  rows: CategoryRow[];
  readOnly: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  /** Đổi vị trí một bước (Alt+↑/↓). */
  onMove: (id: string, dir: -1 | 1) => void;
  /** Thả: chuyển hàng `from` tới vị trí `to`. */
  onReorder: (from: number, to: number) => void;
  saving?: boolean;
  hrefFor: (adminPath: string) => string;
}) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div data-category-list aria-busy={saving || undefined}>
      <div aria-hidden className={`hidden md:grid ${COLS} gap-x-4 ${KIN_TABLE_HEAD}`}>
        <span />
        <span>Danh mục</span><span>Khoá học</span><span />
      </div>
      <ul>
        {rows.map((c, i) => (
          <li key={c.id} data-category-row={c.name}
            draggable={!readOnly}
            onDragStart={() => { dragFrom.current = i; }}
            onDragOver={e => { if (dragFrom.current != null) { e.preventDefault(); setOver(i); } }}
            onDragLeave={() => setOver(o => (o === i ? null : o))}
            onDrop={e => { e.preventDefault(); const f = dragFrom.current; dragFrom.current = null; setOver(null); if (f != null && f !== i) onReorder(f, i); }}
            onDragEnd={() => { dragFrom.current = null; setOver(null); }}
            className={`grid grid-cols-[minmax(0,1fr)_auto] ${COLS} gap-x-4 gap-y-1 ${KIN_TABLE_ROW} ${activeId === c.id ? "bg-[var(--kin-nen-dang-chon)]" : "hover:bg-[var(--kin-nen-re-chuot)]"} ${over === i ? "border-t-2 border-t-[var(--kin-nhan-nen)]" : ""}`}>
            <span aria-hidden className={`hidden md:inline-block select-none text-[var(--kin-chu-mo)] ${readOnly ? "invisible" : "cursor-grab"}`}>⋮⋮</span>
            <div className="min-w-0">
              {readOnly ? (
                <p className="font-medium text-[var(--kin-chu-chinh)] truncate">{c.name}</p>
              ) : (
                <button type="button" onClick={() => onOpen(c.id)}
                  aria-label={`Sửa danh mục ${c.name}. Alt cùng mũi tên lên xuống để đổi thứ tự.`}
                  onKeyDown={e => {
                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); onMove(c.id, e.key === "ArrowUp" ? -1 : 1); }
                  }}
                  className="block w-full min-h-11 md:min-h-0 text-left font-medium text-[var(--kin-chu-chinh)] truncate hover:underline focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
                  {c.name}
                </button>
              )}
              <p className="text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)] truncate">{c.slug}</p>
            </div>
            <p className="text-[var(--kin-chu-phu)] max-md:col-span-2 tabular-nums">{courseCountText(c, readOnly)}</p>
            <Link href={hrefFor(`/admin/khoa-hoc?kythi=${encodeURIComponent(c.name)}`)} aria-label={`Xem khoá của ${c.name}`}
              className="inline-flex items-center md:justify-end min-h-11 text-[var(--kin-nhan-link)] hover:underline whitespace-nowrap max-md:col-start-2 max-md:row-start-1">
              Xem khoá
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
