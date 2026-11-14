// DG-GIAO-LOP (14/11/2026) — khối "Gia sư chủ lớp" ở trang lớp của quản trị (/admin/khoa-hoc/[id], tab Cài đặt). Chỉ quản trị trung tâm (admin_super /
// admin_content) thấy; gia sư (adminRole teacher) không thấy (trang cha không dựng khối này và API cũng trả 403).
// Đọc / ghi qua /api/admin/khoa-hoc/[id]/chu-lop (JSON, như mọi API của khu quản trị). Có đủ trạng thái đang tải / lỗi (Thử lại) / rỗng.
// TIỀN: không hiện số tiền; nếu lớp còn phiếu / khoản phí chưa xử lý thì API chặn (409) và khối hiện nguyên câu báo của API.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinSelect } from "@/components/kin/KinSelect";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinLoader } from "@/components/kin/KinLoader";
import { KinStatus } from "@/components/kin/Status";
import { useKinConfirm } from "@/components/kin/useConfirm";

interface Person { id: string; name: string }
type Load = { kind: "loading" } | { kind: "error" } | { kind: "ok"; owner: Person | null; tutors: Person[] };

export default function GiaoChuLop({ courseId, courseName, onAssigned }: { courseId: string; courseName: string; onAssigned?: () => void }) {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { ask, dialog } = useKinConfirm();
  const url = `/api/admin/khoa-hoc/${encodeURIComponent(courseId)}/chu-lop`;

  // Chỉ đặt trạng thái sau khi có kết quả (không setState đồng bộ trong effect); "Thử lại" tự đặt "đang tải" trước khi gọi.
  const load = useCallback(async () => {
    try {
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { owner: Person | null; tutors: Person[] };
      setState({ kind: "ok", owner: d.owner, tutors: d.tutors });
    } catch { setState({ kind: "error" }); }
  }, [url]);
  useEffect(() => {
    let alive = true;
    fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { owner: Person | null; tutors: Person[] }) => { if (alive) setState({ kind: "ok", owner: d.owner, tutors: d.tutors }); })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, [url]);

  async function submit() {
    if (state.kind !== "ok" || !pick) return;
    const t = state.tutors.find(x => x.id === pick);
    if (!t) return;
    const ok = await ask({
      title: `Giao lớp cho ${t.name}?`,
      message: `${t.name} sẽ thành chủ lớp "${courseName}": quản lý học sinh, lịch, bài học và đề của lớp. ${state.owner ? `${state.owner.name} sẽ không còn thấy lớp này trong Lớp của tôi.` : ""}`,
      confirmLabel: "Giao lớp", tone: "thuong",
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ tutorId: pick }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; movedExams?: number };
      if (r.ok) {
        setMsg({ ok: true, text: `Đã giao lớp cho ${t.name}.${d.movedExams ? ` ${d.movedExams} đề của lớp đã chuyển theo.` : ""}` });
        setPick("");
        await load();
        onAssigned?.();
      } else setMsg({ ok: false, text: d.error ?? "Chưa giao được lớp. Thử lại sau." });
    } catch { setMsg({ ok: false, text: "Mất kết nối. Thử lại sau." }); }
    setBusy(false);
  }

  return (
    <section data-giao-chu-lop aria-labelledby="giao-chu-lop-title"
      className="mb-6 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-4 space-y-3 max-w-xl">
      <h2 id="giao-chu-lop-title" className="text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">Gia sư chủ lớp</h2>
      {state.kind === "loading" && <div className="py-2"><KinLoader size={28} label="Đang tải gia sư chủ lớp" /></div>}
      {state.kind === "error" && (
        <div className="space-y-2">
          <p className="text-[length:var(--kin-co-goc)]"><KinStatus tone="loi">Chưa tải được danh sách gia sư</KinStatus></p>
          <button type="button" onClick={() => { setState({ kind: "loading" }); void load(); }} className={kinButtonClass("secondary")}>Thử lại</button>
        </div>
      )}
      {state.kind === "ok" && (
        <>
          <p data-chu-lop-hien-tai className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
            {state.owner ? <>Chủ lớp hiện tại: <strong>{state.owner.name}</strong></> : "Lớp chưa có gia sư chủ lớp (lớp của trung tâm)."}
          </p>
          {state.tutors.filter(t => t.id !== state.owner?.id).length === 0 ? (
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa có gia sư nào khác đã duyệt hồ sơ để giao lớp. Duyệt hồ sơ gia sư ở mục Gia sư trước.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label id="giao-chu-lop-label" htmlFor="giao-chu-lop-chon" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] mb-1">Giao cho gia sư</label>
                <KinSelect id="giao-chu-lop-chon" value={pick} onChange={setPick} placeholder="Chọn gia sư" disabled={busy} data-giao-chu-lop-chon
                  options={state.tutors.filter(t => t.id !== state.owner?.id).map(t => ({ value: t.id, label: t.name }))} />
              </div>
              <p className="text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">
                Gia sư được giao thành chủ lớp. Lớp còn phiếu học phí chưa tất toán hoặc khoản phí chưa vào phiếu của chủ lớp hiện tại thì chưa giao được.
              </p>
              <button type="button" onClick={() => void submit()} disabled={busy || !pick} className={kinButtonClass("primary")} data-giao-chu-lop-nut>
                {busy ? "Đang giao…" : "Giao lớp"}
              </button>
            </div>
          )}
        </>
      )}
      {msg && <p role="status" data-giao-chu-lop-msg className="text-[length:var(--kin-co-goc)]"><KinStatus tone={msg.ok ? "xong" : "loi"}>{msg.text}</KinStatus></p>}
      {dialog}
    </section>
  );
}
