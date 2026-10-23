// HP-24 + HP-32 — hộp thoại "Gộp khoản rời" (vào phiếu NHÁP) và "Giảm giá phần trăm" cho từng em.
// Số tiền do máy chủ tính (attachLooseCharges / composeFinalAmount); ở đây chỉ hiển thị kết quả và bắt xác nhận.
"use client";
import { useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinCallout } from "@/components/kin/Callout";
import { FIELD_STYLE, Modal, callApi, useNotify, vnd } from "@/components/tutor/shared";

interface AttachPlan { count: number; total: number; net: number; amountDueFrom: number; amountDueTo: number; lines: Array<{ courseName: string; description: string; amount: number }> }

/** Xem trước các khoản rời sẽ gộp vào phiếu nháp, rồi "Giữ nguyên" hoặc "Gộp vào phiếu". */
export function AttachDialog({ invoiceId, code, studentName, onClose, onDone }: { invoiceId: string; code: string; studentName: string; onClose: () => void; onDone: () => void | Promise<void> }) {
  const notify = useNotify();
  const [plan, setPlan] = useState<AttachPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErr(null); setPlan(null);
    callApi<AttachPlan>(`/api/tutor/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify({ action: "attach_charges", preview: true }) }).then(r => {
      if (!alive) return;
      if (!r.ok) setErr(r.data.error ?? "Không xem trước được"); else setPlan(r.data);
    });
    return () => { alive = false; };
  }, [invoiceId, tick]);

  async function go() {
    setBusy(true);
    const r = await callApi<{ error?: string }>(`/api/tutor/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify({ action: "attach_charges" }) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không gộp được"); setTick(t => t + 1); return; }
    notify.ok("Đã gộp khoản rời vào phiếu nháp.");
    await onDone();
    onClose();
  }
  return (
    <Modal title={`Gộp khoản rời — ${studentName} (${code})`} onClose={onClose} labelledBy="attach-title">
      {err ? (
        <div role="alert" className="text-sm"><KinCallout title="Chưa gộp được">{err}</KinCallout>
          <div className="mt-3 flex justify-end gap-2"><KinButton variant="ghost" onClick={onClose}>Đóng</KinButton><KinButton variant="secondary" onClick={() => setTick(t => t + 1)}>Thử lại</KinButton></div></div>
      ) : !plan ? (
        <p role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tính…</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p style={{ color: "var(--kin-chu-phu)" }}>Các khoản dưới đây chưa vào phiếu nào. Gộp xong, số phải đóng của phiếu nháp này thay đổi; phiếu đã gửi cho phụ huynh không bị đổi.</p>
          <ul className="border-t border-[var(--kin-vien-nhat)]">
            {plan.lines.map((l, i) => (
              <li key={i} className="py-2 border-b border-[var(--kin-vien-nhat)] flex justify-between gap-3">
                <span style={{ color: "var(--kin-chu-chinh)" }}>{l.courseName} · {l.description}</span>
                <span className="tabular-nums">{vnd(l.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="tabular-nums" role="status">Số phải đóng: {vnd(plan.amountDueFrom)} → <b>{vnd(plan.amountDueTo)}</b>{plan.net !== plan.total ? ` (đã trừ giảm giá ${vnd(plan.total - plan.net)})` : ""}</p>
          <div className="flex justify-end gap-2 flex-wrap">
            <KinButton variant="ghost" onClick={onClose}>Giữ nguyên</KinButton>
            <KinButton loading={busy} onClick={() => void go()}>Gộp vào phiếu</KinButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface DiscRow { studentId: string; name: string; percent: number }

/** Giảm giá % cho từng em. Chỉ áp khi lập phiếu MỚI; phiếu đã lập không đổi. */
export function DiscountDialog({ onClose }: { onClose: () => void }) {
  const notify = useNotify();
  const [rows, setRows] = useState<DiscRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    callApi<{ items: DiscRow[] }>("/api/tutor/student-discounts").then(r => {
      if (!alive) return;
      if (!r.ok) setFailed(true); else { setRows(r.data.items); setDraft(Object.fromEntries(r.data.items.map(i => [i.studentId, String(i.percent)]))); }
    });
    return () => { alive = false; };
  }, [tick]);

  async function save(row: DiscRow) {
    setBusy(row.studentId);
    const r = await callApi<{ error?: string }>("/api/tutor/student-discounts", { method: "POST", body: JSON.stringify({ studentId: row.studentId, percent: Number(draft[row.studentId] ?? "0") }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được"); return; }
    notify.ok(`Đã lưu giảm giá cho ${row.name}. Áp từ phiếu lập sau này.`);
    setTick(t => t + 1);
  }
  return (
    <Modal title="Giảm giá phần trăm cho từng em" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>Áp khi lập phiếu mới (trên tổng học phí của tháng). Phiếu đã lập không đổi. Để 0 để bỏ giảm giá.</p>
      {failed ? (
        <p role="alert" className="text-sm">Không tải được danh sách. <button className="underline font-medium min-h-11 px-2 text-[var(--kin-nhan-link)]" onClick={() => setTick(t => t + 1)}>Thử lại</button></p>
      ) : rows === null ? (
        <p role="status" className="text-sm">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Chưa có em nào đang học lớp của bạn.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto border-t border-[var(--kin-vien-nhat)]">
          {rows.map(r => {
            const v = draft[r.studentId] ?? "0";
            const changed = Number(v) !== r.percent;
            return (
              <li key={r.studentId} className="py-2 border-b border-[var(--kin-vien-nhat)] flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-[8rem] text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</span>
                <label className="sr-only" htmlFor={`pct-${r.studentId}`}>Giảm giá của {r.name} (%)</label>
                <input id={`pct-${r.studentId}`} inputMode="numeric" value={v} onChange={e => setDraft(d => ({ ...d, [r.studentId]: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                  className="w-20 px-3 py-2 rounded-lg min-h-[44px] tabular-nums" style={FIELD_STYLE} />
                <span className="text-sm">%</span>
                <KinButton variant="secondary" disabled={!changed || Number(v) > 100} loading={busy === r.studentId} onClick={() => void save(r)}>Lưu</KinButton>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end mt-4"><KinButton variant="ghost" onClick={onClose}>Đóng</KinButton></div>
    </Modal>
  );
}
