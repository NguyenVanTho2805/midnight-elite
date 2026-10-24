// TT-200 — tab "Chờ đối soát" (Figma 205:76). KiN chỉ tự gạch khi chắc chắn; mọi
// trường hợp khác nằm ở đây để gia sư bấm quyết. Gợi ý theo số tiền chỉ là gợi ý.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton, KinMoney } from "@/components/kin";
import Link from "next/link";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/Button";
import { ReverseDialog } from "./PaymentTools";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, copyText, monthLabel, useNotify, vnd } from "@/components/tutor/shared";

interface InvView { id: string; code: string; yearMonth: string; studentName: string; amountDue: number; paidAmount: number; remaining: number; status: string }
interface Tx {
  id: string; provider: string; occurredAt: string; amount: number; content: string; matchedCode: string | null;
  kind: string; kindLabel: string; status: string; resolution: string | null; appliedAmount: number;
  invoice: InvView | null; suggestions: InvView[];
}
const RESOLUTION: Record<string, string> = {
  auto_matched: "Tự gạch phiếu", applied_partial: "Đã ghi nhận vào phiếu", credit_next_month: "Trừ vào tháng sau",
  refunded: "Đã trả lại", matched_manual: "Gia sư ghép tay", manual_cash: "Tiền mặt", not_tuition: "Không phải tiền học",
};
const fmtTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

export default function ReconcileTab({ onCount }: { onCount: (n: number) => void }) {
  const notify = useNotify();
  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<Tx | null>(null);
  const [reverseId, setReverseId] = useState<string | null>(null); // HP-21
  const seq = useRef(0);

  const load = useCallback(async (all: boolean) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<{ items: Tx[]; pendingCount: number }>(`/api/tutor/bank-transactions?status=${all ? "all" : "pending"}`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else { setItems(r.data.items); onCount(r.data.pendingCount); }
    setLoading(false);
  }, [onCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(showAll);
  }, [load, showAll]);

  async function resolve(tx: Tx, body: Record<string, unknown>, okMsg: string): Promise<boolean> {
    setBusy(tx.id);
    const r = await callApi<{ error?: string }>(`/api/tutor/bank-transactions/${tx.id}/resolve`, { method: "POST", body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Xử lý thất bại"); await load(showAll); return false; }
    notify.ok(okMsg);
    await load(showAll);
    return true;
  }

  async function remindRest(tx: Tx) {
    if (!tx.invoice) return;
    const rest = tx.invoice.remaining - tx.amount;
    const ok = await copyText(`KiN — ${tx.invoice.studentName} đã chuyển ${vnd(tx.amount)} cho học phí ${monthLabel(tx.invoice.yearMonth).toLowerCase()}. Còn thiếu ${vnd(rest)}, anh/chị chuyển giúp với nội dung ${tx.invoice.code}. Cảm ơn anh/chị!`);
    if (ok) notify.ok("Đã sao chép tin nhắc phần còn lại."); else notify.err("Không sao chép được.");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>
          KiN chỉ tự gạch phiếu khi đúng mã và đúng số tiền còn lại. Các khoản dưới đây cần bạn quyết.
        </p>
        <label className="flex items-center gap-2 text-sm min-h-[44px]" style={{ color: "var(--kin-chu-chinh)" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Hiện cả khoản đã xử lý
        </label>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải hàng chờ">{[0, 1].map(i => <div key={i} className="h-[96px] rounded kin-skel kin-skel--soft" />)}</div>
      ) : failed ? (
        <div role="alert" className="py-8 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          Không tải được hàng chờ.{" "}
          <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={() => load(showAll)}>Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <KinEmptyState title={showAll ? "Chưa có khoản tiền nào." : "Không có khoản nào cần đối soát."}
          action={<Link href="/lop-cua-toi/hoc-phi" className={kinButtonClass("secondary")}>Xem phiếu học phí</Link>}>
          Khoản tiền vào tài khoản nhận học phí sẽ hiện ở đây khi cần bạn quyết.
        </KinEmptyState>
      ) : (
        <ul className="border-t border-[var(--kin-vien-nhat)]">
          {items.map(tx => {
            const pending = tx.status === "pending";
            return (
              <li key={tx.id} className="py-5 border-b border-[var(--kin-vien-nhat)]">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[22px] leading-7 font-medium tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}><KinMoney>{vnd(tx.amount)}</KinMoney></p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{fmtTime(tx.occurredAt)}{tx.provider === "manual" ? " · ghi tay" : ""}</p>
                  </div>
                  <div className="text-right">
                    {pending
                      ? <Badge tone={tx.kind === "exact" ? "wait" : "bad"}>{tx.kindLabel}</Badge>
                      : tx.status === "reversed" ? <Badge tone="neutral">Đã hoàn tác</Badge>
                      : <Badge tone="ok">{RESOLUTION[tx.resolution ?? ""] ?? "Đã xử lý"}</Badge>}
                  </div>
                </div>
                <p className="mt-2 text-sm break-words font-mono" style={{ color: "var(--kin-chu-chinh)" }}>{tx.content || "(không có nội dung)"}</p>

                {tx.invoice && (
                  <p className="mt-2 text-sm" style={{ color: "var(--kin-chu-phu)" }}>
                    Phiếu <b>{tx.invoice.code}</b> · {tx.invoice.studentName} · {monthLabel(tx.invoice.yearMonth)} · còn lại <b><KinMoney>{vnd(tx.invoice.remaining)}</KinMoney></b> / <KinMoney>{vnd(tx.invoice.amountDue)}</KinMoney>
                  </p>
                )}

                {(tx.status === "matched" || tx.status === "resolved") && tx.invoice && (
                  <div className="mt-3"><KinButton variant="secondary" onClick={() => setReverseId(tx.id)}>Hoàn tác khoản này…</KinButton></div>
                )}

                {pending && (tx.kind === "no_code" || tx.kind === "unknown_code") && tx.suggestions.length > 0 && (
                  <div className="mt-3 rounded-lg p-3" style={{ border: "1px dashed var(--kin-vien-thuong)" }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--kin-chu-phu)" }}>Gợi ý: phiếu chưa đóng có cùng số tiền (KiN không tự ghép)</p>
                    <ul className="space-y-1">
                      {tx.suggestions.map(s => (
                        <li key={s.id} className="flex items-center justify-between gap-2 flex-wrap text-sm">
                          <span>{s.studentName} · {monthLabel(s.yearMonth)} · <span className="font-mono">{s.code}</span></span>
                          <KinButton variant="secondary" loading={busy === tx.id} onClick={() => resolve(tx, { action: "match_invoice", invoiceId: s.id }, "Đã ghép vào phiếu.")}>Ghép vào phiếu này</KinButton>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pending && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {tx.kind === "short" && <>
                      <KinButton loading={busy === tx.id} onClick={() => resolve(tx, { action: "apply" }, "Đã ghi nhận một phần.")}>Ghi nhận một phần</KinButton>
                      <KinButton variant="secondary" onClick={() => remindRest(tx)}>Soạn tin nhắc phần còn lại</KinButton>
                    </>}
                    {tx.kind === "exact" && <KinButton loading={busy === tx.id} onClick={() => resolve(tx, { action: "apply" }, "Đã ghi nhận, phiếu đã đóng.")}>Ghi nhận</KinButton>}
                    {(tx.kind === "over" || tx.kind === "already_paid" || tx.kind === "cancelled") && <>
                      <KinButton loading={busy === tx.id} onClick={() => resolve(tx, { action: "credit_next_month" }, "Đã ghi: trừ vào tháng sau.")}>Trừ vào tháng sau</KinButton>
                      <KinButton variant="secondary" loading={busy === tx.id} onClick={() => resolve(tx, { action: "refunded" }, "Đã ghi: đã trả lại.")}>Ghi đã trả lại</KinButton>
                    </>}
                    {(tx.kind === "no_code" || tx.kind === "unknown_code" || tx.kind === "already_paid" || tx.kind === "cancelled") &&
                      <KinButton variant="secondary" onClick={() => setPicker(tx)}>Ghép vào phiếu…</KinButton>}
                    <KinButton variant="ghost" loading={busy === tx.id} onClick={() => resolve(tx, { action: "not_tuition" }, "Đã ẩn khoản này (không xoá).")}>Không phải tiền học</KinButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {reverseId && <ReverseDialog txId={reverseId} onClose={() => setReverseId(null)} onDone={() => load(showAll)} />}
      {picker && <PickInvoice tx={picker} onClose={() => setPicker(null)}
        onPick={async (inv, excess) => { if (await resolve(picker, { action: "match_invoice", invoiceId: inv.id, ...(excess ? { excess } : {}) }, "Đã ghép vào phiếu.")) setPicker(null); }} />}
    </div>
  );
}

function PickInvoice({ tx, onClose, onPick }: { tx: Tx; onClose: () => void; onPick: (inv: InvView, excess?: "credit" | "refunded") => Promise<void> }) {
  const [all, setAll] = useState<InvView[] | null>(null);
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<InvView | null>(null);
  const [excess, setExcess] = useState<"credit" | "refunded">("credit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    callApi<{ items: Array<InvView & { studentName: string }> }>("/api/tutor/invoices").then(r => {
      if (!alive) return;
      if (!r.ok) { setErr(true); return; }
      setAll(r.data.items.filter(i => i.status !== "paid" && i.status !== "cancelled"));
    });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => (all ?? []).filter(i => !q.trim() || i.studentName.toLowerCase().includes(q.trim().toLowerCase()) || i.code.includes(q.trim().toUpperCase())), [all, q]);
  const over = chosen ? Math.max(0, tx.amount - chosen.remaining) : 0;

  return (
    <Modal title={`Ghép ${vnd(tx.amount)} vào phiếu`} onClose={onClose}>
      {!chosen ? (<>
        <label className="sr-only" htmlFor="pick-q">Tìm phiếu</label>
        <input id="pick-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên em hoặc mã phiếu…" className="w-full px-3 py-2 rounded-lg mb-3 min-h-[44px]" style={FIELD_STYLE} />
        {err ? <p role="alert" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tải được danh sách phiếu.</p>
          : all === null ? <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tải…</p>
          : shown.length === 0 ? <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Không có phiếu chưa đóng nào khớp.</p>
          : <ul className="space-y-1 max-h-72 overflow-y-auto">
              {shown.map(i => (
                <li key={i.id}>
                  <button className="w-full text-left px-3 py-2 rounded-lg min-h-[44px]" style={CARD_STYLE} onClick={() => setChosen(i)}>
                    <span className="font-medium">{i.studentName}</span> · {monthLabel(i.yearMonth)} · <span className="font-mono text-xs">{i.code}</span>
                    <span className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Còn lại {vnd(i.remaining)}</span>
                  </button>
                </li>
              ))}
            </ul>}
        <div className="flex justify-end mt-4"><KinButton variant="ghost" onClick={onClose}>Đóng</KinButton></div>
      </>) : (<>
        <p className="text-sm mb-3"><b>{chosen.studentName}</b> · {monthLabel(chosen.yearMonth)} · còn lại {vnd(chosen.remaining)}</p>
        {over > 0 && (
          <fieldset className="mb-3 text-sm">
            <legend className="font-medium mb-1">Khoản này dư {vnd(over)} so với phần còn lại — xử lý thế nào?</legend>
            {([["credit", "Trừ vào tháng sau"], ["refunded", "Đã trả lại phụ huynh"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="pick-excess" checked={excess === v} onChange={() => setExcess(v)} /> {l}</label>
            ))}
          </fieldset>
        )}
        <div className="flex justify-between gap-2">
          <KinButton variant="ghost" onClick={() => setChosen(null)}>← Chọn phiếu khác</KinButton>
          <KinButton loading={busy} onClick={async () => { setBusy(true); await onPick(chosen, over > 0 ? excess : undefined); setBusy(false); }}>Ghép vào phiếu</KinButton>
        </div>
      </>)}
    </Modal>
  );
}
