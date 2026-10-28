// NC2-050 — quản lý CÔNG THỨC TÍNH điểm xét tuyển (hiện ở công cụ "Tính điểm" của trang công khai /diem-chuan). Quản lý trung tâm (admin_super, admin_content).
// Công thức là cấu hình có cấu trúc: điểm = (Σ hệ số môn × điểm môn) × hệ số nhân + điểm cộng. Chỉ công khai khi có đường dẫn nguồn; bật "Đã đối chiếu" khi đã so với thông báo chính thức của trường.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, useNotify } from "@/components/tutor/shared";
import { describeFormula, maxBase, parseFormulaInput, FORMULA_MAX_BONUSES, FORMULA_MAX_INPUTS, type FormulaValue } from "@/lib/admissionFormula";
import { formatScore } from "@/lib/admissionScore";

interface Item { id: string; name: string; value: FormulaValue | null; broken: boolean }
interface Payload { formulas: Item[]; total: number; published: number }
interface SubjectRow { label: string; max: string; weight: string }
interface BonusRow { label: string; max: string }
interface Form {
  name: string; school: string; year: string; scale: string; multiplier: string;
  inputs: SubjectRow[]; bonuses: BonusRow[]; note: string; sourceUrl: string; sourceName: string; verified: boolean; published: boolean;
}

const emptyForm = (): Form => ({ name: "", school: "", year: String(new Date().getFullYear()), scale: "30", multiplier: "1", inputs: [{ label: "", max: "10", weight: "1" }, { label: "", max: "10", weight: "1" }, { label: "", max: "10", weight: "1" }], bonuses: [], note: "", sourceUrl: "", sourceName: "", verified: false, published: false });
const comma = (n: number) => String(n).replace(".", ",");
const toForm = (v: FormulaValue): Form => ({
  name: v.name, school: v.school, year: v.year === null ? "" : String(v.year), scale: String(v.scale), multiplier: comma(v.multiplier),
  inputs: v.inputs.map(i => ({ label: i.label, max: comma(i.max), weight: comma(i.weight) })), bonuses: v.bonuses.map(b => ({ label: b.label, max: comma(b.max) })),
  note: v.note, sourceUrl: v.sourceUrl, sourceName: v.sourceName, verified: v.verified, published: v.published,
});
const toBody = (f: Form) => ({ ...f });

export default function CongThucAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_NEWS}>
      <Content />
    </PermissionGuard>
  );
}

function Content() {
  const notify = useNotify();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/admin/diem-chuan/cong-thuc");
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const live = useMemo(() => (editing ? parseFormulaInput(toBody(editing.form)) : null), [editing]);

  async function save() {
    if (!editing) return;
    setBusy("save"); setFormError("");
    const body = JSON.stringify(toBody(editing.form));
    const r = editing.id ? await callApi(`/api/admin/diem-chuan/cong-thuc/${editing.id}`, { method: "PATCH", body }) : await callApi("/api/admin/diem-chuan/cong-thuc", { method: "POST", body });
    setBusy(null);
    if (!r.ok) { setFormError(r.data.error ?? "Không lưu được"); return; }
    notify.ok(editing.id ? "Đã lưu thay đổi." : "Đã thêm công thức.");
    setEditing(null);
    await load();
  }
  async function toggle(it: Item, field: "verified" | "published") {
    if (!it.value) return;
    setBusy(`${it.id}:${field}`);
    const r = await callApi(`/api/admin/diem-chuan/cong-thuc/${it.id}`, { method: "PATCH", body: JSON.stringify({ [field]: !it.value[field] }) });
    setBusy(null);
    if (!r.ok) notify.err(r.data.error ?? "Không cập nhật được");
    await load();
  }
  async function remove() {
    if (!deleting) return;
    setBusy("delete");
    const r = await callApi(`/api/admin/diem-chuan/cong-thuc/${deleting.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không xoá được"); return; }
    notify.ok("Đã xoá công thức.");
    setDeleting(null);
    await load();
  }

  const btn = "px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]";
  const fld = "block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]";
  const set = (patch: Partial<Form>) => setEditing(e => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const setInput = (i: number, patch: Partial<SubjectRow>) => setEditing(e => (e ? { ...e, form: { ...e.form, inputs: e.form.inputs.map((x, k) => (k === i ? { ...x, ...patch } : x)) } } : e));
  const setBonus = (i: number, patch: Partial<BonusRow>) => setEditing(e => (e ? { ...e, form: { ...e.form, bonuses: e.form.bonuses.map((x, k) => (k === i ? { ...x, ...patch } : x)) } } : e));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <div>
        <Link href="/admin/diem-chuan" className="inline-flex items-center min-h-[44px] text-sm underline" style={{ color: "var(--kin-nhan-link)" }}>← Điểm chuẩn tuyển sinh</Link>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Công thức tính điểm xét tuyển</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
          Hiện ở công cụ <b>Tính điểm</b> của trang công khai <code>/diem-chuan</code>. Kết quả luôn ghi <b>chỉ mang tính tham khảo</b>. Điểm = (Σ hệ số môn × điểm môn) × hệ số nhân + điểm cộng, tối đa bằng thang.
          Chỉ công khai khi có đường dẫn nguồn; chỉ bật <b>Đã đối chiếu</b> khi đã so với thông báo chính thức của trường. KiN không lưu điểm người dùng nhập.
        </p>
      </div>

      {loading && !data ? (
        <div aria-busy="true" className="h-32 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />
      ) : failed || !data ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được dữ liệu. <button className="underline font-semibold" onClick={() => void load()}>Thử lại</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" data-add-formula className={btn} style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }} onClick={() => { setFormError(""); setEditing({ id: null, form: emptyForm() }); }}>+ Thêm công thức</button>
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} aria-live="polite">Tổng {data.total} công thức · công khai {data.published}</p>
          </div>
          {data.total === 0 ? (
            <p role="status" className="rounded-xl p-8 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
              Chưa có công thức nào. Trang công khai chỉ hiện công cụ tính khi có ít nhất một công thức đã công khai.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
              <table className="w-full text-sm" style={{ background: "var(--kin-nen-trang)" }}>
                <caption className="sr-only">Danh sách công thức tính điểm</caption>
                <thead>
                  <tr style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                    <th scope="col" className="text-left px-3 py-2">Công thức</th>
                    <th scope="col" className="text-left px-3 py-2">Cách tính</th>
                    <th scope="col" className="text-right px-3 py-2">Thang</th>
                    <th scope="col" className="text-left px-3 py-2">Nguồn</th>
                    <th scope="col" className="text-left px-3 py-2">Đối chiếu</th>
                    <th scope="col" className="text-left px-3 py-2">Công khai</th>
                    <th scope="col" className="text-right px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.formulas.map(it => {
                    const v = it.value;
                    return (
                      <tr key={it.id} data-formula-row style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                        <th scope="row" className="text-left px-3 py-2 font-normal">
                          <div className="font-semibold">{it.name}</div>
                          <div className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{v ? [v.school, v.year].filter(Boolean).join(" · ") : ""}</div>
                        </th>
                        <td className="px-3 py-2">{v ? describeFormula(v) : <span style={{ color: "var(--kin-tt-chu-loi)" }}>Dữ liệu hỏng — xoá và nhập lại</span>}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{v ? v.scale : "—"}</td>
                        <td className="px-3 py-2">{v?.sourceUrl ? <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{v.sourceName}<span aria-hidden> ↗</span></a> : <span style={{ color: "var(--kin-chu-mo)" }}>Chưa có</span>}</td>
                        <td className="px-3 py-2">
                          {v ? (
                            <button type="button" role="switch" aria-checked={v.verified} aria-label={`Đã đối chiếu: ${it.name}`} disabled={busy === `${it.id}:verified`} onClick={() => void toggle(it, "verified")} className="min-h-[44px]">
                              <Badge tone={v.verified ? "ok" : "wait"}>{v.verified ? "Đã đối chiếu" : "Chưa đối chiếu"}</Badge>
                            </button>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {v ? (
                            <button type="button" role="switch" aria-checked={v.published} aria-label={`Công khai: ${it.name}`} disabled={busy === `${it.id}:published`} onClick={() => void toggle(it, "published")} className="min-h-[44px]">
                              <Badge tone={v.published ? "ok" : "neutral"}>{v.published ? "Công khai" : "Bản nháp"}</Badge>
                            </button>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {v && <button type="button" className="underline font-semibold min-h-[44px] px-2" aria-label={`Sửa ${it.name}`} onClick={() => { setFormError(""); setEditing({ id: it.id, form: toForm(v) }); }}>Sửa</button>}
                          <button type="button" className="underline font-semibold min-h-[44px] px-2" style={{ color: "var(--kin-tt-chu-loi)" }} aria-label={`Xoá ${it.name}`} onClick={() => setDeleting(it)}>Xoá</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal title={editing.id ? "Sửa công thức" : "Thêm công thức"} onClose={() => setEditing(null)} labelledBy="ct-form-title">
          <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3" data-formula-form>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tên công thức
              <input id="ct-name" value={editing.form.name} onChange={e => set({ name: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="VD: Khối A00 — Toán nhân đôi" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Trường (nếu có)
                <input value={editing.form.school} onChange={e => set({ school: e.target.value })} className={fld} style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Năm (nếu có)
                <input inputMode="numeric" value={editing.form.year} onChange={e => set({ year: e.target.value })} className={fld} style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Thang điểm (tối đa)
                <input id="ct-scale" inputMode="numeric" value={editing.form.scale} onChange={e => set({ scale: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="30" />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Hệ số nhân (sau khi cộng các môn)
                <input id="ct-mul" inputMode="decimal" value={editing.form.multiplier} onChange={e => set({ multiplier: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="1  (VD 0,75)" />
              </label>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Các môn / thành phần (tối đa {FORMULA_MAX_INPUTS})</legend>
              {editing.form.inputs.map((r, i) => (
                <div key={i} data-subject-row className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2 items-end">
                  <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Môn {i + 1}
                    <input value={r.label} onChange={e => setInput(i, { label: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="Toán" />
                  </label>
                  <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tối đa
                    <input inputMode="decimal" value={r.max} onChange={e => setInput(i, { max: e.target.value })} className={fld} style={FIELD_STYLE} />
                  </label>
                  <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Hệ số
                    <input inputMode="decimal" value={r.weight} onChange={e => setInput(i, { weight: e.target.value })} className={fld} style={FIELD_STYLE} />
                  </label>
                  <button type="button" aria-label={`Bỏ môn ${i + 1}`} disabled={editing.form.inputs.length <= 1} onClick={() => set({ inputs: editing.form.inputs.filter((_, k) => k !== i) })} className="min-h-[44px] min-w-[44px] underline text-sm">Bỏ</button>
                </div>
              ))}
              <button type="button" className="underline text-sm min-h-[44px]" disabled={editing.form.inputs.length >= FORMULA_MAX_INPUTS} onClick={() => set({ inputs: [...editing.form.inputs, { label: "", max: "10", weight: "1" }] })}>+ Thêm môn</button>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Điểm cộng (ưu tiên, khuyến khích… — cộng SAU khi nhân; tối đa {FORMULA_MAX_BONUSES})</legend>
              {editing.form.bonuses.map((r, i) => (
                <div key={i} data-bonus-row className="grid grid-cols-[1fr_6rem_auto] gap-2 items-end">
                  <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tên khoản {i + 1}
                    <input value={r.label} onChange={e => setBonus(i, { label: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="Điểm ưu tiên" />
                  </label>
                  <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Mức tối đa
                    <input inputMode="decimal" value={r.max} onChange={e => setBonus(i, { max: e.target.value })} className={fld} style={FIELD_STYLE} />
                  </label>
                  <button type="button" aria-label={`Bỏ khoản cộng ${i + 1}`} onClick={() => set({ bonuses: editing.form.bonuses.filter((_, k) => k !== i) })} className="min-h-[44px] min-w-[44px] underline text-sm">Bỏ</button>
                </div>
              ))}
              <button type="button" className="underline text-sm min-h-[44px]" disabled={editing.form.bonuses.length >= FORMULA_MAX_BONUSES} onClick={() => set({ bonuses: [...editing.form.bonuses, { label: "", max: "1" }] })}>+ Thêm khoản cộng</button>
            </fieldset>

            <p data-formula-preview role="status" className="rounded-lg p-3 text-xs" style={{ background: "var(--kin-nen-bang)", color: live && live.ok ? "var(--kin-chu-phu)" : "var(--kin-tt-chu-cho)" }}>
              {live && live.ok
                ? <>Cách tính: <b>{describeFormula(live.value)}</b>. Điểm tối đa phần môn: {formatScore(maxBase(live.value))} / thang {live.value.scale}.</>
                : <>Chưa hợp lệ: {live && !live.ok ? live.error : ""}</>}
            </p>

            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Đường dẫn nguồn (bắt buộc để công khai)
              <input id="ct-url" value={editing.form.sourceUrl} onChange={e => set({ sourceUrl: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="https://..." />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tên nguồn (để trống: lấy tên miền)
              <input value={editing.form.sourceName} onChange={e => set({ sourceName: e.target.value })} className={fld} style={FIELD_STYLE} />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Ghi chú cho người dùng (VD: áp dụng cho tổ hợp nào)
              <textarea value={editing.form.note} onChange={e => set({ note: e.target.value })} rows={2} className={fld} style={FIELD_STYLE} />
            </label>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" checked={editing.form.verified} onChange={e => set({ verified: e.target.checked })} /> Đã đối chiếu với thông báo chính thức của trường</label>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input id="ct-pub" type="checkbox" checked={editing.form.published} onChange={e => set({ published: e.target.checked })} /> Công khai ở trang /diem-chuan</label>
            {formError && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setEditing(null)}>Huỷ</button>
              <button type="submit" className={btn} style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }} disabled={busy === "save"}>Lưu</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Xoá công thức?" onClose={() => setDeleting(null)} labelledBy="ct-del-title">
          <p className="text-sm mb-4" style={{ color: "var(--kin-chu-phu)" }}>{deleting.name}. Không khôi phục được.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setDeleting(null)}>Giữ lại</button>
            <button type="button" className={btn} style={{ background: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" }} disabled={busy === "delete"} onClick={() => void remove()}>Xoá</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
