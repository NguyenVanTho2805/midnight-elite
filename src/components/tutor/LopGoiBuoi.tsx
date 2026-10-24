// HP-31 — "Gói buổi trả trước và sổ sử dụng" trong tab Học phí của lớp kiểu mới (theo buổi / theo giờ). SỔ BUỔI, không thu tiền, không chuyển tiền.
// Mọi số (số dư, giá ghi lúc lập) do MÁY CHỦ tính; ở đây chỉ hiển thị. Lớp cách cũ / theo khoá: không hiện mục này.
// Chữ nói thật: sổ buổi chưa tự bớt khoản nào trên phiếu; cách ghi nhận cần kế toán duyệt trước khi dùng thật (PACKAGE_NOTICE).
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, useKinConfirm } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi, useNotify } from "@/components/tutor/shared";
import { CHARGE_LINK_LABEL, PACKAGE_MAX_SESSIONS, PACKAGE_NOTE_MAX, PACKAGE_STATUS_LABEL, type ChargeLink, type PackageStatus } from "@/lib/sessionPackage";
import type { FeeMode } from "@/lib/tuitionFee";

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const dmy = (iso: string) => { const d = new Date(new Date(iso).getTime() + 7 * 3600_000); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`; };
interface Row {
  id: string; studentId: string; studentName: string; sessions: number; used: number; balance: number; unitPrice: number; totalPrice: number;
  status: PackageStatus; note: string | null; createdAt: string; cancelledAt: string | null; uses: Array<{ dateKey: string; reversed: boolean; chargeLink: ChargeLink }>;
}
interface Data { items: Row[]; students: Array<{ id: string; name: string }>; notice: string }
const TONE: Record<PackageStatus, "xong" | "mo"> = { active: "xong", used_up: "mo", cancelled: "mo" };

export default function LopGoiBuoi({ courseId, feeMode }: { courseId: string; feeMode: FeeMode }) {
  const notify = useNotify();
  const { ask, dialog } = useKinConfirm();
  const enabled = feeMode === "per_session" || feeMode === "per_hour";
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [studentId, setStudentId] = useState("");
  const [sessions, setSessions] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    callApi<Data>(`/api/courses/${courseId}/packages`).then(r => { if (!alive) return; if (!r.ok) setFailed(true); else setData(r.data); });
    return () => { alive = false; };
  }, [courseId, enabled, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);
  if (!enabled) return null;

  async function create() {
    const n = Number(sessions);
    const name = data?.students.find(s => s.id === studentId)?.name ?? "em này";
    const yes = await ask({ title: "Lập gói buổi?", message: `Ghi gói ${n} buổi cho ${name}. Đây chỉ là sổ theo dõi số buổi: KiN không thu tiền và chưa tự bớt khoản nào trên phiếu học phí.`, confirmLabel: "Lập gói", cancelLabel: "Giữ nguyên", tone: "thuong" });
    if (!yes) return;
    setBusy(true); setErr(null);
    const r = await callApi<{ error?: string; totalPrice?: number }>(`/api/courses/${courseId}/packages`, { method: "POST", body: JSON.stringify({ studentId, sessions: n, note }) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error ?? "Không lập được gói"); return; }
    notify.ok(`Đã lập gói ${n} buổi.`);
    setSessions(""); setNote(""); reload();
  }
  async function cancel(p: Row) {
    const yes = await ask({ title: "Huỷ gói này?", message: `Gói ${p.sessions} buổi của ${p.studentName} sẽ không trừ buổi mới nữa. Các buổi đã trừ vẫn giữ trong sổ.`, confirmLabel: "Huỷ gói", cancelLabel: "Giữ nguyên", tone: "nguy-hiem" });
    if (!yes) return;
    const r = await callApi<{ error?: string }>(`/api/courses/${courseId}/packages/${p.id}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) });
    if (!r.ok) notify.err(r.data.error ?? "Không huỷ được"); else { notify.ok("Đã huỷ gói."); reload(); }
  }

  return (
    <section aria-labelledby="gb-t" className="max-w-3xl" data-goi-buoi>
      <KinSectionHead id="gb-t" title="Gói buổi trả trước" aside="Sổ sử dụng" />
      <div className="pt-4"><KinCallout title="Sổ buổi, không phải thu tiền">{data?.notice ?? "Sổ buổi chỉ để theo dõi số buổi còn lại. KiN không thu hay chuyển tiền và chưa tự bớt khoản nào trên phiếu học phí."}</KinCallout></div>

      {failed ? (
        <div role="alert" className="py-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          Không tải được sổ gói buổi.{" "}
          <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={reload}>Thử lại</button>
        </div>
      ) : !data ? (
        <div aria-busy="true" aria-label="Đang tải sổ gói buổi" className="mt-4 h-24 rounded kin-skel kin-skel--soft" />
      ) : data.items.length === 0 ? (
        <div className="pt-4"><KinEmptyState title="Chưa có gói buổi nào">Khi em trả trước một số buổi, cô lập gói ở dưới. Mỗi buổi đã chốt mà em có mặt hoặc đi muộn sẽ trừ một buổi trong gói.</KinEmptyState></div>
      ) : (
        <ul className="pt-3">
          {data.items.map(p => (
            <li key={p.id} className="py-4 border-b border-[var(--kin-vien-nhat)]" data-goi-buoi-row>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)] break-words">{p.studentName}</p>
                  <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lập ngày {dmy(p.createdAt)}{p.note ? ` · ${p.note}` : ""}</p>
                </div>
                <KinStatus tone={TONE[p.status]}>{PACKAGE_STATUS_LABEL[p.status]}</KinStatus>
              </div>
              <p className="pt-2 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-chinh)]">Gói {p.sessions} buổi · đã dùng {p.used} · <b>còn {p.balance}</b></p>
              <p className="text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-mo)]">Giá ghi lúc lập: {vnd(p.unitPrice)}/buổi × {p.sessions} = {vnd(p.totalPrice)} (chỉ ghi lại, KiN không thu)</p>
              <div className="pt-2 flex gap-2 flex-wrap">
                <KinButton variant="ghost" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>{open === p.id ? "Ẩn lịch sử" : `Xem lịch sử (${p.uses.length})`}</KinButton>
                {p.status !== "cancelled" && <KinButton variant="ghost" onClick={() => void cancel(p)}>Huỷ gói</KinButton>}
              </div>
              {open === p.id && (
                p.uses.length === 0
                  ? <p className="pt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa trừ buổi nào. Buổi được trừ khi cô bấm Đã dạy xong và em có mặt hoặc đi muộn.</p>
                  : (
                    <ul className="pt-2 text-[length:var(--kin-co-goc)]" data-goi-buoi-uses>
                      {p.uses.map((u, i) => (
                        <li key={i} className="py-2 border-t border-[var(--kin-vien-nhat)] flex justify-between gap-3 flex-wrap">
                          <span className="text-[var(--kin-chu-chinh)]">Buổi {ddmm(u.dateKey)}{u.reversed ? " · đã trả lại" : ""}</span>
                          {!u.reversed && u.chargeLink !== "none" && <span className="text-[var(--kin-tt-chu-cho)]">{CHARGE_LINK_LABEL[u.chargeLink]}</span>}
                        </li>
                      ))}
                    </ul>
                  )
              )}
            </li>
          ))}
        </ul>
      )}

      {data && (
        <div className="pt-5">
          <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Lập gói cho một em</p>
          <div className="pt-3 grid sm:grid-cols-3 gap-5">
            <label className={KIN_LABEL}>Em lập gói
              <select value={studentId} onChange={e => { setStudentId(e.target.value); setErr(null); }} className={`${KIN_FIELD} mt-2`}>
                <option value="">Chọn em…</option>
                {data.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={KIN_LABEL}>Số buổi (1–{PACKAGE_MAX_SESSIONS})
              <input inputMode="numeric" value={sessions} onChange={e => { setSessions(e.target.value.replace(/[^\d]/g, "")); setErr(null); }} className={`${KIN_FIELD} mt-2`} />
            </label>
            <label className={KIN_LABEL}>Ghi chú gói (tuỳ chọn)
              <input value={note} maxLength={PACKAGE_NOTE_MAX} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: gói tháng 11" className={`${KIN_FIELD} mt-2`} />
            </label>
          </div>
          {err && <p role="alert" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
          <div className="pt-4"><KinButton variant="secondary" loading={busy} disabled={!studentId || !sessions || Number(sessions) < 1} onClick={() => void create()}>Lập gói…</KinButton></div>
        </div>
      )}
      {dialog}
    </section>
  );
}
