// HP-21 — màn rà soát hoàn tác khoản đã thu ("Giữ nguyên" / "Xác nhận hoàn tác") và danh sách khoản đã thu của một phiếu.
// Giao diện chỉ HIỂN THỊ kết quả máy chủ tính (planReversal chạy ở GET .../reverse); không tự tính tiền ở đây.
"use client";
import { useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinCallout } from "@/components/kin/Callout";
import { Badge, FIELD_STYLE, Modal, callApi, monthLabel, useNotify, vnd } from "@/components/tutor/shared";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/tuitionInvoice";
import { REVERSAL_REASON_MAX } from "@/lib/tuitionPayment";
import { hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

const statusLabel = (s: string) => INVOICE_STATUS_LABEL[s as InvoiceStatus] ?? s;
const vnWhen = (iso: string) => { const d = new Date(iso); const k = vnDateKeyOf(d); return `${hmOf(vnMinutesOfDay(d))} ngày ${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`; };

interface Preview {
  tx: { id: string; provider: string; method: string | null; amount: number; appliedAmount: number; content: string; occurredAt: string; status: string };
  invoice: { id: string; code: string; studentName: string; yearMonth: string; amountDue: number; paidAmount: number; status: string } | null;
  plan:
    | { ok: true; outcome: "requeued" | "voided"; reversedAmount: number; invoiceStatusFrom: string; invoiceStatusTo: string; paidBefore: number; paidAfter: number; remainingAfter: number; creditsVoidedTotal: number; untrackedExcess: number }
    | { ok: false; code: string; blocker: string };
}

/** Màn rà soát: nói rõ điều gì sẽ đổi, bắt lý do, mặc định KHÔNG làm gì (nút "Giữ nguyên"). */
export function ReverseDialog({ txId, onClose, onDone }: { txId: string; onClose: () => void; onDone: () => void | Promise<void> }) {
  const notify = useNotify();
  const [prev, setPrev] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrev(null); setFailed(false);
    callApi<Preview>(`/api/tutor/bank-transactions/${txId}/reverse`).then(r => {
      if (!alive) return;
      if (!r.ok) setFailed(true); else setPrev(r.data);
    });
    return () => { alive = false; };
  }, [txId, tick]);

  async function submitReversal() {
    setBusy(true);
    const r = await callApi<{ error?: string; outcome?: string }>(`/api/tutor/bank-transactions/${txId}/reverse`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), confirm: true }) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Hoàn tác thất bại"); setTick(t => t + 1); return; }
    notify.ok(r.data.outcome === "requeued" ? "Đã hoàn tác. Khoản tiền quay lại hàng chờ đối soát để ghép lại." : "Đã hoàn tác khoản ghi tay.");
    await onDone();
    onClose();
  }

  const plan = prev?.plan;
  return (
    <Modal title="Rà soát hoàn tác khoản đã thu" onClose={onClose}>
      {failed ? (
        <div role="alert" className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
          Không tải được thông tin khoản này.{" "}
          <button className="underline font-medium min-h-11 px-2 text-[var(--kin-nhan-link)]" onClick={() => setTick(t => t + 1)}>Thử lại</button>
        </div>
      ) : !prev ? (
        <p role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tải…</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-[22px] leading-7 font-medium tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}>{vnd(prev.tx.amount)}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{vnWhen(prev.tx.occurredAt)}{prev.tx.provider === "manual" ? " · gia sư ghi tay" : ""}</p>
            {prev.invoice && <p className="mt-1" style={{ color: "var(--kin-chu-phu)" }}>Phiếu <b>{prev.invoice.code}</b> · {prev.invoice.studentName} · {monthLabel(prev.invoice.yearMonth)}</p>}
          </div>

          {plan && !plan.ok ? (
            <div role="alert"><KinCallout title="Không hoàn tác được">{plan.blocker}</KinCallout></div>
          ) : plan ? (<>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2" aria-label="Điều sẽ đổi nếu xác nhận">
              <dt style={{ color: "var(--kin-chu-mo)" }}>Đã nhận trên phiếu</dt>
              <dd className="tabular-nums">{vnd(plan.paidBefore)} → <b>{vnd(plan.paidAfter)}</b></dd>
              <dt style={{ color: "var(--kin-chu-mo)" }}>Còn lại</dt>
              <dd className="tabular-nums"><b>{vnd(plan.remainingAfter)}</b></dd>
              <dt style={{ color: "var(--kin-chu-mo)" }}>Trạng thái phiếu</dt>
              <dd>{statusLabel(plan.invoiceStatusFrom)} → <b>{statusLabel(plan.invoiceStatusTo)}</b></dd>
              {plan.creditsVoidedTotal > 0 && (<><dt style={{ color: "var(--kin-chu-mo)" }}>Tiền dư trừ tháng sau</dt><dd className="tabular-nums">thu hồi <b>{vnd(plan.creditsVoidedTotal)}</b></dd></>)}
            </dl>
            <p style={{ color: "var(--kin-chu-phu)" }}>
              {plan.outcome === "requeued"
                ? "Khoản tiền này đã vào tài khoản của bạn nên không bị xoá: nó quay lại hàng chờ đối soát để bạn ghép vào đúng phiếu."
                : "Khoản này do bạn ghi tay nên sẽ được coi là ghi nhầm và không tính vào doanh thu. Dòng ghi vẫn được giữ lại để tra cứu."}
            </p>
            {plan.untrackedExcess > 0 && (
              <KinCallout title="Phần dư không hoàn tác được">
                {vnd(plan.untrackedExcess)} dư của khoản này không nằm trong tiền trừ tháng sau (ví dụ đã ghi “đã trả lại” ngoài hệ thống). KiN không đảo được việc đó.
              </KinCallout>
            )}
            <div>
              <label className="block mb-1 font-medium" htmlFor="rev-reason" style={{ color: "var(--kin-chu-chinh)" }}>Lý do hoàn tác (bắt buộc)</label>
              <textarea id="rev-reason" rows={3} value={reason} maxLength={REVERSAL_REASON_MAX} onChange={e => setReason(e.target.value)}
                placeholder="Ví dụ: ghép nhầm sang phiếu của em khác" className="w-full px-3 py-2 rounded-lg" style={FIELD_STYLE} />
            </div>
          </>) : null}

          <div className="flex justify-end gap-2 flex-wrap">
            <KinButton variant="ghost" onClick={onClose}>Giữ nguyên</KinButton>
            {plan?.ok && (
              <KinButton disabled={!reason.trim()} loading={busy} onClick={() => void submitReversal()}
                style={{ background: "var(--kin-tt-chu-loi)", borderColor: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" }}>Xác nhận hoàn tác</KinButton>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

interface PayRow { id: string; provider: string; method: string | null; amount: number; appliedAmount: number; status: string; resolution: string | null; occurredAt: string }
const methodText = (t: PayRow) => t.provider === "manual" ? (t.method === "bank_transfer" ? "Chuyển khoản (ghi tay)" : "Tiền mặt / ghi tay") : "Chuyển khoản (SePay)";

/** Các khoản tiền của một phiếu, mỗi khoản có nút "Hoàn tác…" mở màn rà soát ở trên. */
export function PaymentsDialog({ invoiceId, code, studentName, onClose, onChanged }: { invoiceId: string; code: string; studentName: string; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [rows, setRows] = useState<PayRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [reverse, setReverse] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null); setFailed(false);
    callApi<{ transactions: PayRow[] }>(`/api/tutor/invoices/${invoiceId}`).then(r => {
      if (!alive) return;
      if (!r.ok) setFailed(true); else setRows(r.data.transactions);
    });
    return () => { alive = false; };
  }, [invoiceId, tick]);

  // Không lồng hai hộp thoại (trùng id tiêu đề, Esc đóng cả hai): đang rà soát thì thay thế danh sách, đóng rà soát thì quay lại danh sách.
  if (reverse) return <ReverseDialog txId={reverse} onClose={() => setReverse(null)} onDone={async () => { setTick(t => t + 1); await onChanged(); }} />;
  return (
    <Modal title={`Khoản đã thu — ${studentName} (${code})`} onClose={onClose}>
      {failed ? (
        <div role="alert" className="text-sm">Không tải được. <button className="underline font-medium min-h-11 px-2 text-[var(--kin-nhan-link)]" onClick={() => setTick(t => t + 1)}>Thử lại</button></div>
      ) : rows === null ? (
        <p role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Phiếu này chưa có khoản tiền nào được ghi.</p>
      ) : (
        <ul className="border-t border-[var(--kin-vien-nhat)]">
          {rows.map(t => {
            const reversible = (t.status === "matched" || t.status === "resolved");
            return (
              <li key={t.id} className="py-3 border-b border-[var(--kin-vien-nhat)] flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}>{vnd(t.amount)}{t.appliedAmount !== t.amount ? <span className="text-xs font-normal" style={{ color: "var(--kin-chu-phu)" }}> (vào phiếu {vnd(t.appliedAmount)})</span> : null}</p>
                  <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{vnWhen(t.occurredAt)} · {methodText(t)}</p>
                </div>
                {t.status === "reversed"
                  ? <Badge tone="neutral">Đã hoàn tác</Badge>
                  : t.status === "pending"
                    ? <Badge tone="wait">Chờ đối soát</Badge>
                    : reversible ? <KinButton variant="secondary" onClick={() => setReverse(t.id)}>Hoàn tác…</KinButton> : <Badge tone="neutral">Đã xử lý</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end mt-4"><KinButton variant="ghost" onClick={onClose}>Đóng</KinButton></div>
    </Modal>
  );
}
