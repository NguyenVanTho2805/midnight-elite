// Mảnh giao diện dùng chung cho các trang hồ sơ học sinh của gia sư (wizard, chi tiết, nhập hàng loạt, trường tuỳ chỉnh).
// Chỉ token --kin-*, trạng thái luôn có chữ, vùng chạm ≥ 44px.
"use client";
import { useId, type ReactNode } from "react";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

export function TextField({ label, value, onChange, error, hint, type = "text", inputMode, placeholder, maxLength, required, autoComplete = "off", name, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; type?: string; inputMode?: "text" | "tel" | "email" | "numeric";
  placeholder?: string; maxLength?: number; required?: boolean; autoComplete?: string; name?: string; onBlur?: () => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`${KIN_LABEL} mb-2`}>{label}{required ? " *" : ""}</label>
      <input id={id} name={name} type={type} inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} onBlur={onBlur}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} autoComplete={autoComplete} className={KIN_FIELD} />
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>
        : hint ? <p id={`${id}-h`} className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, value, onChange, error, hint, maxLength, rows = 3, onBlur }: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; maxLength?: number; rows?: number; onBlur?: () => void }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`${KIN_LABEL} mb-2`}>{label}</label>
      <textarea id={id} value={value} rows={rows} maxLength={maxLength} onChange={e => onChange(e.target.value)} onBlur={onBlur} aria-invalid={error ? true : undefined}
        className={`${KIN_FIELD} py-2 leading-5`} />
      {error ? <p role="alert" className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>
        : hint ? <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</p> : null}
    </div>
  );
}

export function SelectField({ label, value, onChange, children, hint }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`${KIN_LABEL} mb-2`}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={KIN_FIELD}>{children}</select>
      {hint && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{hint}</p>}
    </div>
  );
}

/** Nhóm nút chọn một (radio) cao ≥ 44px, chữ rõ. */
export function RadioCards<K extends string>({ legend, value, onChange, options, name }: { legend: string; value: K | ""; onChange: (k: K) => void; options: { key: K; title: string; sub?: string }[]; name: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className={`${KIN_LABEL} mb-2`}>{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(o => (
          <label key={o.key} className={`flex items-start gap-3 min-h-11 px-3 py-2 rounded-[var(--kin-bo-md)] border cursor-pointer ${value === o.key ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]"}`}>
            <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onChange(o.key)} className="mt-1 size-5 shrink-0" />
            <span className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]"><span className="block font-medium">{o.title}</span>{o.sub && <span className="text-[var(--kin-chu-mo)]">{o.sub}</span>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export async function jfetch(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
    let json: unknown = null; try { json = await r.json(); } catch { /* không phải JSON */ }
    return { ok: r.ok, status: r.status, json };
  } catch { return { ok: false, status: 0, json: null }; }
}

export const fmtVnDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export const fmtVnDateTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
/** "2014-05-01" → "01/05/2014" */
export const keyToVn = (k: string | null | undefined) => (k && /^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : k ?? "");
