// NC2-050 — công cụ "Tính điểm xét tuyển" ở /diem-chuan. Công thức do quản trị nhập (chỉ hiện công thức đã công khai và có nguồn).
// Kết quả CHỈ MANG TÍNH THAM KHẢO: câu lưu ý hiện thường trực (không chỉ sau khi tính), cùng cách tính từng bước, nguồn và nhãn "chưa đối chiếu".
// Điểm người dùng nhập được tính ngay ở trình duyệt, KHÔNG gửi lên máy chủ, KiN không lưu.
"use client";
import { useMemo, useState } from "react";
import { computeScore, describeFormula, FORMULA_DISCLAIMER, type ComputeResult, type PublicFormula } from "@/lib/admissionFormula";
import { formatScore } from "@/lib/admissionScore";
import { kinButtonClass } from "@/components/kin/Button";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

const label = (f: PublicFormula) => `${f.name}${f.school ? ` — ${f.school}` : ""}${f.year ? ` (${f.year})` : ""}`;

export default function TinhDiemChuan({ formulas }: { formulas: PublicFormula[] }) {
  const [fid, setFid] = useState(formulas[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ComputeResult | null>(null);
  const f = useMemo(() => formulas.find(x => x.id === fid) ?? formulas[0], [formulas, fid]);
  if (!f) return null;

  const errors = result && !result.ok ? result.errors : {};
  const pick = (id: string) => { setFid(id); setValues({}); setResult(null); };
  const run = () => setResult(computeScore(f, values));
  const field = (key: string, name: string, max: number, optional = false) => (
    <div key={key}>
      <label htmlFor={`tc-${key}`} className={KIN_LABEL}>{name}{optional && <span style={{ color: "var(--kin-chu-mo)" }}> (không bắt buộc)</span>}</label>
      <input id={`tc-${key}`} name={key} inputMode="decimal" autoComplete="off" value={values[key] ?? ""} placeholder={`0 – ${formatScore(max)}`}
        onChange={e => { setValues(v => ({ ...v, [key]: e.target.value })); setResult(null); }}
        aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `tc-${key}-err` : undefined} className={`${KIN_FIELD} mt-1`} />
      {errors[key] && <p id={`tc-${key}-err`} className="mt-1 text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>{errors[key]}</p>}
    </div>
  );

  return (
    <section aria-labelledby="tc-h" data-score-calc className="rounded-xl p-5 mb-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <h2 id="tc-h" className="text-lg font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Tính điểm xét tuyển</h2>
      <p data-calc-disclaimer className="mt-1 text-sm" style={{ color: "var(--kin-tt-chu-cho)" }}><b>Chỉ mang tính tham khảo.</b> KiN không lưu điểm bạn nhập.</p>

      {formulas.length > 1 && (
        <div className="mt-3">
          <label htmlFor="tc-sel" className={KIN_LABEL}>Chọn công thức</label>
          <select id="tc-sel" value={f.id} onChange={e => pick(e.target.value)} className={`${KIN_FIELD} mt-1`}>
            {formulas.map(x => <option key={x.id} value={x.id}>{label(x)}</option>)}
          </select>
        </div>
      )}

      <div className="mt-3 text-sm" style={{ color: "var(--kin-chu-phu)" }}>
        <p><b>{label(f)}</b> · thang {f.scale}</p>
        <p data-calc-how className="mt-1">Cách tính: {describeFormula(f)}</p>
        {f.note && <p className="mt-1" style={{ color: "var(--kin-chu-mo)" }}>{f.note}</p>}
        <p className="mt-1">
          Nguồn: <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 underline" style={{ color: "var(--kin-nhan-link)" }}>{f.sourceName}<span aria-hidden> ↗</span></a>
          {!f.verified && <span data-calc-unverified className="font-medium" style={{ color: "var(--kin-tt-chu-cho)" }}> · Chưa đối chiếu với thông báo của trường</span>}
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); run(); }} noValidate className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {f.inputs.map(i => field(i.key, i.weight === 1 ? i.label : `${i.label} (hệ số ${formatScore(i.weight)})`, i.max))}
          {f.bonuses.map(b => field(b.key, b.label, b.max, true))}
        </div>
        {Object.keys(errors).length > 0 && <p role="alert" className="mt-3 text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>Có {Object.keys(errors).length} ô chưa đúng — xem lời nhắc dưới từng ô.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={kinButtonClass("primary")}>Tính điểm</button>
          <button type="button" className={kinButtonClass("secondary")} onClick={() => { setValues({}); setResult(null); }}>Xoá nhập</button>
        </div>
      </form>

      {result?.ok && (
        <div data-calc-result role="status" className="mt-5 rounded-lg p-4" style={{ background: "var(--kin-nen-nhan)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Điểm tính được (tham khảo)</p>
          <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}>{formatScore(result.score)}<span className="text-base font-normal" style={{ color: "var(--kin-chu-mo)" }}> / {f.scale}</span></p>
          {result.capped && <p className="mt-1 text-sm" style={{ color: "var(--kin-tt-chu-cho)" }}>Theo công thức được {formatScore(result.raw)}, vượt thang nên hiện ở mức tối đa {f.scale}.</p>}
          <ul className="mt-3 text-sm list-disc pl-5" style={{ color: "var(--kin-chu-phu)" }}>{result.lines.map((l, k) => <li key={k}>{l}</li>)}</ul>
          <p data-calc-result-note className="mt-3 text-sm" style={{ color: "var(--kin-chu-phu)" }}>{FORMULA_DISCLAIMER}</p>
        </div>
      )}
    </section>
  );
}
