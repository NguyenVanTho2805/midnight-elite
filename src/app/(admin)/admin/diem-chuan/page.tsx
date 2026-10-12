// FE-099 — quản lý điểm chuẩn tuyển sinh (hiện ở /diem-chuan). Quản lý trung tâm (admin_super, admin_content).
// Mỗi dòng PHẢI có đường dẫn nguồn. "Đã đối chiếu" = người quản trị đã so với thông báo chính thức của trường.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, useNotify } from "@/components/tutor/shared";
import { IMPORT_COLUMNS, SCORE_METHODS, formatScore, methodLabel } from "@/lib/admissionScore";

interface Row {
  id: string; school: string; major: string; variant: string; year: number; method: string; score: number; scale: number;
  note: string | null; sourceUrl: string; sourceName: string; verified: boolean; published: boolean;
}
interface Payload { rows: Row[]; total: number; published: number; verified: number; usingSeed: boolean; seedCount: number }
interface Form { school: string; major: string; variant: string; year: string; method: string; score: string; scale: string; sourceUrl: string; sourceName: string; note: string; verified: boolean; published: boolean }
interface DryRun { ok: boolean; valid: number; willCreate?: number; willUpdate?: number; errors?: { line: number; error: string }[] }

const emptyForm = (): Form => ({ school: "", major: "", variant: "", year: String(new Date().getFullYear()), method: "thpt", score: "", scale: "30", sourceUrl: "", sourceName: "", note: "", verified: false, published: true });
const toForm = (r: Row): Form => ({ school: r.school, major: r.major, variant: r.variant, year: String(r.year), method: r.method, score: String(r.score).replace(".", ","), scale: String(r.scale), sourceUrl: r.sourceUrl, sourceName: r.sourceName, note: r.note ?? "", verified: r.verified, published: r.published });
const SAMPLE = `${IMPORT_COLUMNS.join(",")}\nĐại học ABC,Công nghệ thông tin,,2025,thpt,27.5,30,https://example.edu.vn/diem-chuan,Website trường,,false,true`;

export default function DiemChuanAdminPage() {
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
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const [dry, setDry] = useState<{ text: string; res: DryRun } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/admin/diem-chuan");
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data?.rows ?? []).filter(r => !n || `${r.school} ${r.major} ${r.variant}`.toLowerCase().includes(n));
  }, [data, q]);

  async function save() {
    if (!editing) return;
    setBusy("save"); setFormError("");
    const f = editing.form;
    const body = { ...f };
    const r = editing.id
      ? await callApi(`/api/admin/diem-chuan/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
      : await callApi("/api/admin/diem-chuan", { method: "POST", body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { setFormError(r.data.error ?? "Không lưu được"); return; }
    notify.ok(editing.id ? "Đã lưu thay đổi." : "Đã thêm dòng.");
    setEditing(null);
    await load();
  }
  async function toggle(row: Row, field: "verified" | "published") {
    setBusy(`${row.id}:${field}`);
    const r = await callApi(`/api/admin/diem-chuan/${row.id}`, { method: "PATCH", body: JSON.stringify({ [field]: !row[field] }) });
    setBusy(null);
    if (!r.ok) notify.err(r.data.error ?? "Không cập nhật được");
    await load();
  }
  async function remove() {
    if (!deleting) return;
    setBusy("delete");
    const r = await callApi(`/api/admin/diem-chuan/${deleting.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không xoá được"); return; }
    notify.ok("Đã xoá dòng.");
    setDeleting(null);
    await load();
  }
  async function seed() {
    setBusy("seed");
    const r = await callApi<{ created: number; skipped: number }>("/api/admin/diem-chuan/seed", { method: "POST" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không nạp được"); return; }
    notify.ok(`Đã thêm ${r.data.created} dòng${r.data.skipped ? `, bỏ qua ${r.data.skipped} dòng đã có` : ""}.`);
    await load();
  }
  async function check() {
    setBusy("check");
    const r = await callApi<DryRun>("/api/admin/diem-chuan/import", { method: "POST", body: JSON.stringify({ text, dryRun: true }) });
    setBusy(null);
    if (r.status === 0 || (!r.ok && r.status !== 422)) { notify.err(r.data.error ?? "Không kiểm tra được"); return; }
    setDry({ text, res: r.data });
  }
  async function runImport() {
    setBusy("import");
    const r = await callApi<{ created: number; updated: number }>("/api/admin/diem-chuan/import", { method: "POST", body: JSON.stringify({ text }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không nhập được"); return; }
    notify.ok(`Đã nhập: thêm ${r.data.created}, cập nhật ${r.data.updated}.`);
    setImporting(false); setText(""); setDry(null);
    await load();
  }

  const btn = "px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]";
  const set = (patch: Partial<Form>) => setEditing(e => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Điểm chuẩn tuyển sinh</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
          Dữ liệu hiện ở trang công khai <code>/diem-chuan</code>. Mỗi dòng bắt buộc có đường dẫn nguồn. Chỉ bật <b>Đã đối chiếu</b> khi bạn đã so với thông báo chính thức của trường.
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
          {data.usingSeed && (
            <p role="status" className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
              Cơ sở dữ liệu đang trống nên trang công khai tạm hiện {data.seedCount} dòng dữ liệu khởi đầu có sẵn (chưa lưu vào cơ sở dữ liệu, chưa sửa được). Bấm <b>Nạp dữ liệu khởi đầu</b> để lưu chúng rồi chỉnh sửa.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" className={btn} style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }} onClick={() => { setFormError(""); setEditing({ id: null, form: emptyForm() }); }}>+ Thêm dòng</button>
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => { setDry(null); setImporting(true); }}>Nhập CSV / JSON</button>
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} disabled={busy === "seed"} onClick={() => void seed()}>Nạp dữ liệu khởi đầu ({data.seedCount} dòng)</button>
            <label className="text-xs ml-auto" style={{ color: "var(--kin-chu-phu)" }}>Tìm trường / ngành
              <input value={q} onChange={e => setQ(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} placeholder="VD: Bách khoa" />
            </label>
          </div>
          <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} aria-live="polite">
            Tổng {data.total} dòng · công khai {data.published} · đã đối chiếu {data.verified}{q.trim() && <> · đang lọc {rows.length}</>}
          </p>

          {data.total === 0 ? (
            <p role="status" className="rounded-xl p-8 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>Chưa có dòng nào.</p>
          ) : rows.length === 0 ? (
            <p role="status" className="rounded-xl p-8 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>Không có dòng nào khớp.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
              <table className="w-full text-sm" style={{ background: "var(--kin-nen-trang)" }}>
                <caption className="sr-only">Danh sách điểm chuẩn</caption>
                <thead>
                  <tr style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                    <th scope="col" className="text-left px-3 py-2">Trường · ngành</th>
                    <th scope="col" className="text-left px-3 py-2">Năm · phương thức</th>
                    <th scope="col" className="text-right px-3 py-2">Điểm</th>
                    <th scope="col" className="text-left px-3 py-2">Nguồn</th>
                    <th scope="col" className="text-left px-3 py-2">Đối chiếu</th>
                    <th scope="col" className="text-left px-3 py-2">Công khai</th>
                    <th scope="col" className="text-right px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                      <th scope="row" className="text-left px-3 py-2 font-normal">
                        <div className="font-semibold">{r.major}{r.variant && <span className="font-normal"> · {r.variant}</span>}</div>
                        <div className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{r.school}</div>
                      </th>
                      <td className="px-3 py-2">{r.year} · {methodLabel(r.method)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatScore(r.score)}/{r.scale}</td>
                      <td className="px-3 py-2"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.sourceName}<span aria-hidden> ↗</span></a></td>
                      <td className="px-3 py-2">
                        <button type="button" role="switch" aria-checked={r.verified} aria-label={`Đã đối chiếu: ${r.major} ${r.year}`} disabled={busy === `${r.id}:verified`} onClick={() => void toggle(r, "verified")} className="min-h-[44px] px-1">
                          <Badge tone={r.verified ? "ok" : "wait"}>{r.verified ? "Đã đối chiếu" : "Chưa đối chiếu"}</Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" role="switch" aria-checked={r.published} aria-label={`Công khai: ${r.major} ${r.year}`} disabled={busy === `${r.id}:published`} onClick={() => void toggle(r, "published")} className="min-h-[44px] px-1">
                          <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Công khai" : "Đang ẩn"}</Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button type="button" className="underline font-semibold min-h-[44px] px-2" aria-label={`Sửa ${r.major} ${r.year}`} onClick={() => { setFormError(""); setEditing({ id: r.id, form: toForm(r) }); }}>Sửa</button>
                        <button type="button" className="underline font-semibold min-h-[44px] px-2" style={{ color: "var(--kin-tt-chu-loi)" }} aria-label={`Xoá ${r.major} ${r.year}`} onClick={() => setDeleting(r)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal title={editing.id ? "Sửa dòng điểm chuẩn" : "Thêm dòng điểm chuẩn"} onClose={() => setEditing(null)} labelledBy="dc-form-title">
          <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3">
            {([["school", "Trường"], ["major", "Ngành"], ["variant", "Chương trình / tổ hợp (nếu có)"]] as const).map(([k, label]) => (
              <label key={k} className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>{label}
                <input value={editing.form[k]} onChange={e => set({ [k]: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Năm
                <input inputMode="numeric" value={editing.form.year} onChange={e => set({ year: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Phương thức
                <select value={editing.form.method} onChange={e => set({ method: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
                  {SCORE_METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Điểm chuẩn
                <input inputMode="decimal" value={editing.form.score} onChange={e => set({ score: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} placeholder="28,5" />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Thang điểm (tối đa)
                <input inputMode="numeric" value={editing.form.scale} onChange={e => set({ scale: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} placeholder="30" />
              </label>
            </div>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Đường dẫn nguồn (bắt buộc)
              <input value={editing.form.sourceUrl} onChange={e => set({ sourceUrl: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} placeholder="https://..." />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tên nguồn (để trống: lấy tên miền)
              <input value={editing.form.sourceName} onChange={e => set({ sourceName: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Ghi chú
              <input value={editing.form.note} onChange={e => set({ note: e.target.value })} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
            </label>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" checked={editing.form.verified} onChange={e => set({ verified: e.target.checked })} /> Đã đối chiếu với thông báo chính thức của trường</label>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" checked={editing.form.published} onChange={e => set({ published: e.target.checked })} /> Hiện ở trang công khai</label>
            {formError && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setEditing(null)}>Huỷ</button>
              <button type="submit" className={btn} style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }} disabled={busy === "save"}>Lưu</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Xoá dòng điểm chuẩn?" onClose={() => setDeleting(null)} labelledBy="dc-del-title">
          <p className="text-sm mb-4" style={{ color: "var(--kin-chu-phu)" }}>{deleting.school} · {deleting.major} · {deleting.year} ({formatScore(deleting.score)}/{deleting.scale}). Không khôi phục được.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setDeleting(null)}>Giữ lại</button>
            <button type="button" className={btn} style={{ background: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" }} disabled={busy === "delete"} onClick={() => void remove()}>Xoá</button>
          </div>
        </Modal>
      )}

      {importing && (
        <Modal title="Nhập điểm chuẩn hàng loạt" onClose={() => setImporting(false)} labelledBy="dc-imp-title">
          <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>
            Dán CSV (có dòng tiêu đề, phân tách , ; hoặc Tab) hoặc mảng JSON. Cột bắt buộc: <code>school, major, year, method, score, scale, sourceUrl</code>. Phương thức: <code>{SCORE_METHODS.map(m => m.key).join(", ")}</code>.
            Chỉ cần một dòng lỗi là không nhập dòng nào. Dòng trùng khoá sẽ <b>cập nhật</b> dòng đã có.
          </p>
          <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Nội dung
            <textarea value={text} onChange={e => { setText(e.target.value); setDry(null); }} rows={8} placeholder={SAMPLE}
              className="block w-full mt-1 px-3 py-2 rounded-lg text-xs font-mono" style={FIELD_STYLE} />
          </label>
          {dry && dry.text === text && (
            dry.res.ok ? (
              <p role="status" className="text-sm font-semibold mt-2" style={{ color: "var(--kin-tt-chu-xong)" }}>
                Hợp lệ {dry.res.valid} dòng — thêm mới {dry.res.willCreate}, cập nhật {dry.res.willUpdate}.
              </p>
            ) : (
              <div role="alert" className="mt-2 text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>
                <p className="font-semibold">Chưa nhập được — sửa {dry.res.errors?.length} lỗi rồi kiểm tra lại:</p>
                <ul className="list-disc pl-5 mt-1 max-h-40 overflow-y-auto">
                  {dry.res.errors?.slice(0, 50).map((e, i) => <li key={i}>{e.line > 0 ? `Dòng ${e.line}: ` : ""}{e.error}</li>)}
                </ul>
              </div>
            )
          )}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setImporting(false)}>Đóng</button>
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} disabled={!text.trim() || busy === "check"} onClick={() => void check()}>Kiểm tra</button>
            <button type="button" className={btn} style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}
              disabled={!(dry && dry.text === text && dry.res.ok) || busy === "import"} onClick={() => void runImport()}>Nhập</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
