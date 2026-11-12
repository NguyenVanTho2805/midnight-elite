// Khối của form sửa trang chủ (HOME-02): một KinPanel có neo, nút "Khôi phục khối này", và ô chữ có bộ đếm + lỗi nối bằng aria-describedby.
"use client";
import type { ReactNode } from "react";
import { KinPanel } from "@/components/kin";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import CharCounter from "./CharCounter";

export const fieldId = (path: string) => "f-" + path.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "");

export function BlockCard({ id, title, hint, canRestore, onRestore, children }: {
  id: string; title: string; hint?: string; canRestore: boolean; onRestore: () => void; children: ReactNode;
}) {
  return (
    <KinPanel as="section" id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 flex flex-col gap-4 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{title}</h2>
          {hint && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</p>}
        </div>
        <button type="button" data-restore={id} disabled={!canRestore} onClick={onRestore}
          className="min-h-11 px-2 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)] underline disabled:no-underline disabled:text-[var(--kin-chu-mo)] disabled:opacity-60 flex-shrink-0">
          Khôi phục khối này
        </button>
      </div>
      {children}
    </KinPanel>
  );
}

/** Ô chữ một dòng / nhiều dòng. `path` là đường dẫn trường (cũng là khoá lỗi). `limit` null = không đếm.
 *  `warn` (LOI-07): cảnh báo KHÔNG chặn lưu (vd đường dẫn trỏ vào phần đang tạm đóng) — chữ màu "chờ" kèm nhãn "Lưu ý:", không viền đỏ, không aria-invalid. */
export function Field({ path, label, value, onChange, limit, error, multiline, rows = 2, help, warn, type, list, placeholder }: {
  path: string; label: string; value: string; onChange: (v: string) => void; limit: number | null; error?: string;
  multiline?: boolean; rows?: number; help?: string; warn?: string | null; type?: string; list?: string; placeholder?: string;
}) {
  const id = fieldId(path), cid = id + "-dem", eid = id + "-loi", hid = id + "-goi-y", wid = id + "-canh-bao";
  const described = [limit ? cid : "", error ? eid : "", help ? hid : "", warn ? wid : ""].filter(Boolean).join(" ") || undefined;
  const common = {
    id, "data-field": path, value, "aria-invalid": error ? true : undefined, "aria-describedby": described, placeholder,
    className: `${KIN_FIELD} py-2 ${error ? "border-[var(--kin-tt-chu-loi)] border-2" : ""}`,
  };
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id} className={KIN_LABEL}>{label}</label>
      {multiline
        ? <textarea {...common} rows={rows} onChange={e => onChange(e.target.value)} />
        : <input {...common} type={type ?? "text"} list={list} onChange={e => onChange(e.target.value)} />}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {help && <p id={hid} className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{help}</p>}
          {warn && <p id={wid} data-field-warn={path} className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]"><span className="font-medium">Lưu ý:</span> {warn}</p>}
          {error && <p id={eid} role="alert" data-field-error={path} className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
        </div>
        {limit ? <CharCounter id={cid} value={value} limit={limit} /> : null}
      </div>
    </div>
  );
}
