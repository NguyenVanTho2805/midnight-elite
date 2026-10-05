// FE-091 — Table dùng chung. Thay bảng tự viết ở admin/hoc-sinh, khoa-hoc,
// thi-thu, tin-tuc, danh-gia, quan-tri-vien...
//
// Hợp đồng:
//   const columns: TableColumn<Student>[] = [
//     { key: "name", header: "Tên", cell: s => s.name },
//     { key: "score", header: "Điểm", cell: s => s.score, align: "right", width: 100 },
//   ];
//   <Table columns={columns} data={students} loading={loading}
//     emptyState={<EmptyState title="Chưa có học viên" />}
//     pagination={{ page, total, onPageChange: setPage }}
//     onRowClick={s => router.push(`/admin/hoc-sinh/${s.id}`)}
//     filterSlot={<SearchInput value={q} onChange={setQ} />}
//   />
"use client";
import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  className?: string;
}

export interface TablePagination {
  page: number;         // 1-indexed
  total: number;        // tổng số bản ghi
  pageSize?: number;    // mặc định 20
  onPageChange: (page: number) => void;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: ReactNode;    // hiển thị khi !loading && data.length === 0
  pagination?: TablePagination;
  onRowClick?: (row: T, index: number) => void;
  filterSlot?: ReactNode;    // thanh filter/search ở trên bảng
  getRowKey?: (row: T, index: number) => string;
  className?: string;
}

export function Table<T>({
  columns, data, loading, emptyState, pagination, onRowClick, filterSlot, getRowKey, className = "",
}: TableProps<T>) {
  const pageSize = pagination?.pageSize ?? 20;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pageSize)) : 1;

  return (
    <div className={`rounded-2xl bg-white shadow-sm ${className}`}>
      {filterSlot ? (
        <div className="px-4 py-3 border-b border-slate-200">{filterSlot}</div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              {columns.map(c => (
                <th
                  key={c.key}
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                  className={`px-4 py-3 font-semibold text-slate-600 whitespace-nowrap ${c.className ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-slate-100">
                  {columns.map(c => (
                    <td key={c.key} className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState ?? (
                    <div className="py-10 text-center text-sm text-slate-500">Chưa có dữ liệu</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={getRowKey ? getRowKey(row, i) : i}
                  className={`border-b border-slate-100 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                >
                  {columns.map(c => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? "left" }}
                      className={`px-4 py-3 text-slate-700 ${c.className ?? ""}`}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 ? (
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm">
          <div className="text-slate-500">
            Trang {pagination.page} / {totalPages} · {pagination.total} bản ghi
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >‹</button>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >›</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
