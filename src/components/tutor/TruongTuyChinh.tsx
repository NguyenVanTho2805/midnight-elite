// LO-18 — Trường tuỳ chỉnh cho hồ sơ học sinh. Chỉ CHỮ ngắn (không tệp, không ảnh), số trường tối đa cấu hình (KIN_CUSTOM_FIELDS_MAX).
// Giá trị trong hồ sơ thuộc phạm vi đồng ý “thông tin mở rộng”. Xoá trường là xoá luôn giá trị đã nhập ở các hồ sơ của bạn.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { TextField, jfetch } from "@/components/tutor/studentUi";

export default function TruongTuyChinh() {
  const { ask, dialog } = useKinConfirm();
  const [fields, setFields] = useState<{ id: string; label: string }[] | null>(null);
  const [max, setMax] = useState(3);
  const [error, setError] = useState(false);
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchFields = useCallback(() => jfetch("/api/tutor/truong-tuy-chinh"), []);
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchFields>>) => {
    if (!r.ok) { setError(true); return; }
    setFields(r.json.fields); setMax(r.json.max); setError(false);
  }, []);
  const load = useCallback(() => { fetchFields().then(apply); }, [fetchFields, apply]);
  useEffect(() => {
    let alive = true;
    fetchFields().then(r => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [fetchFields, apply]);

  async function add() {
    setBusy(true); setMsg(null);
    const r = await jfetch("/api/tutor/truong-tuy-chinh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    setBusy(false);
    if (r.status === 201) { setLabel(""); setMsg({ tone: "ok", text: "Đã thêm trường." }); void load(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa thêm được." });
  }
  async function remove(f: { id: string; label: string }) {
    const ok = await ask({ title: `Xoá trường “${f.label}”?`, message: "Giá trị đã nhập ở trường này trong các hồ sơ của bạn cũng bị xoá. Không hoàn tác được.", confirmLabel: "Xoá trường" });
    if (!ok) return;
    const r = await jfetch(`/api/tutor/truong-tuy-chinh?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
    if (r.ok) { setMsg({ tone: "ok", text: "Đã xoá trường." }); void load(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa xoá được." });
  }

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title="Trường tuỳ chỉnh" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} sub={`Tối đa ${max} trường. Chỉ nhập chữ ngắn.`} />
      <div className="max-w-[560px] space-y-5">
        <KinCallout title="Chỉ ghi điều cần cho việc dạy">Trường tuỳ chỉnh là thông tin thêm về em (ví dụ “Lớp ở trường”). Đừng ghi thông tin nhạy cảm. Phụ huynh có quyền hỏi bạn đã ghi gì.</KinCallout>
        {error && <ErrorStrip message="Không tải được danh sách trường." onRetry={load} />}
        {fields === null ? (!error ? <p aria-busy="true" className="text-[var(--kin-chu-mo)]">Đang tải…</p> : null) : fields.length === 0 ? (
          <KinEmptyState title="Chưa có trường tuỳ chỉnh nào">{max === 0 ? "Tính năng này đang tắt." : "Thêm trường ở dưới, nó sẽ hiện trong hồ sơ của mọi học sinh của bạn."}</KinEmptyState>
        ) : (
          <ul aria-label="Trường tuỳ chỉnh" className="divide-y divide-[var(--kin-vien-nhat)]">
            {fields.map(f => (
              <li key={f.id} data-field className="flex items-center justify-between gap-3 py-2 min-h-11">
                <span className="min-w-0 break-words">{f.label}</span>
                <button type="button" onClick={() => remove(f)} aria-label={`Xoá trường ${f.label}`} className={kinButtonClass("danger")}>Xoá</button>
              </li>
            ))}
          </ul>
        )}
        {fields && fields.length < max && (
          <form onSubmit={e => { e.preventDefault(); void add(); }} className="space-y-3">
            <TextField label="Tên trường mới" value={label} onChange={setLabel} maxLength={40} />
            <button type="submit" disabled={busy || !label.trim()} className={kinButtonClass("primary")}>Thêm trường</button>
          </form>
        )}
        {fields && fields.length >= max && max > 0 && <p className="text-[var(--kin-chu-mo)]">Đã đủ {max} trường. Xoá bớt một trường để thêm trường khác.</p>}
        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}>{msg.text}</p>}
      </div>
    </KinPage>
  );
}
