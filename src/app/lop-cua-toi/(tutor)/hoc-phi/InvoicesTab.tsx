// TT-200 — tab "Phiếu": lập phiếu cả lớp, gửi, sửa số tiền, ghi tiền mặt, huỷ.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { openZalo } from "@/lib/zaloShare";
import { groupInvoiceMessage, invoiceLinkDaysLeft, privateInvoiceMessage } from "@/lib/invoiceZalo";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, copyText, invoiceTone, monthLabel, useNotify, vnd } from "@/components/tutor/shared";
import { vnMonthKey } from "@/lib/revenue";
import { hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const vnDm = (iso: string) => { const k = vnDateKeyOf(new Date(iso)); return `${k.slice(8, 10)}/${k.slice(5, 7)}`; };
const vnWhen = (iso: string) => `${vnHm(iso)} ngày ${vnDm(iso)}`;

export interface InvoiceRow {
  id: string; code: string; yearMonth: string; studentName: string;
  amountDue: number; paidAmount: number; remaining: number;
  status: string; statusLabel: string; cancelReason: string | null; needsBankCheck: boolean; creditApplied: number;
  transferContent: string; qrUrl: string | null;
  zaloOpenedAt: string | null; parentViewedAt: string | null;
}
interface Summary { count: number; totalDue: number; totalPaid: number; totalRemaining: number }
type Dialog =
  | { kind: "amount"; inv: InvoiceRow }
  | { kind: "cancel"; inv: InvoiceRow }
  | { kind: "pay"; inv: InvoiceRow }
  | { kind: "zalo"; inv: InvoiceRow };

function lastMonths(now = new Date()): string[] {
  const base = new Date(now.getTime() + 7 * 3600_000); // giờ VN
  const out: string[] = [];
  for (let i = -1; i < 11; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function InvoicesTab({ onGoPayout }: { onGoPayout: () => void }) {
  const notify = useNotify();
  const months = useMemo(() => lastMonths(), []);
  const [yearMonth, setYearMonth] = useState(() => vnMonthKey(new Date()));
  const [items, setItems] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Array<{ studentId: string; studentName: string; reason: string }>>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (ym: string) => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<{ items: InvoiceRow[]; summary: Summary; hasPayoutAccount: boolean }>(`/api/tutor/invoices?yearMonth=${ym}`);
    if (my !== seq.current) return; // bỏ kết quả cũ khi đổi tháng nhanh
    if (!r.ok) setFailed(true);
    else { setItems(r.data.items); setSummary(r.data.summary); setHasAccount(r.data.hasPayoutAccount); }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(yearMonth);
  }, [load, yearMonth]);

  async function issue() {
    setBusy("issue");
    const r = await callApi<{ created: unknown[]; skipped: typeof skipped }>("/api/tutor/invoices", { method: "POST", body: JSON.stringify({ yearMonth }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không lập được phiếu"); return; }
    setSkipped(r.data.skipped);
    if (r.data.created.length) notify.ok(`Đã lập ${r.data.created.length} phiếu nháp. Kiểm tra rồi bấm Gửi.`);
    else notify.info("Không có phiếu mới để lập.");
    await load(yearMonth);
  }

  async function act(inv: InvoiceRow, body: Record<string, unknown>, okMsg: string) {
    setBusy(inv.id);
    const r = await callApi<{ error?: string }>(`/api/tutor/invoices/${inv.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Thao tác thất bại"); await load(yearMonth); return false; }
    notify.ok(okMsg);
    await load(yearMonth);
    return true;
  }

  async function sendAllDrafts() {
    const drafts = items.filter(i => i.status === "draft");
    if (!drafts.length) return;
    setBusy("send-all");
    let okCount = 0;
    for (const d of drafts) {
      const r = await callApi(`/api/tutor/invoices/${d.id}`, { method: "PATCH", body: JSON.stringify({ action: "send" }) });
      if (r.ok) okCount++;
    }
    setBusy(null);
    notify.ok(`Đã gửi ${okCount}/${drafts.length} phiếu.`);
    await load(yearMonth);
  }

  async function copyMessage(inv: InvoiceRow) {
    const text =
      `KiN — học phí ${monthLabel(inv.yearMonth).toLowerCase()} của ${inv.studentName}: ${vnd(inv.remaining)}.\n` +
      (inv.qrUrl ? `Quét mã QR: ${inv.qrUrl}\n` : "") +
      `Hoặc chuyển khoản với nội dung: ${inv.transferContent}\n` +
      `Anh/chị giữ nguyên mã ${inv.code} ở đầu nội dung để hệ thống ghi nhận đúng. Cảm ơn anh/chị!`;
    const copied = await copyText(text);
    if (copied) notify.ok("Đã sao chép tin nhắn — dán vào Zalo gửi phụ huynh.");
    else notify.err("Không sao chép được, hãy thử lại.");
  }

  const drafts = items.filter(i => i.status === "draft").length;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tháng
          <select value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <KinButton onClick={issue} loading={busy === "issue"}>Lập phiếu cả lớp</KinButton>
        {drafts > 0 && <KinButton variant="secondary" onClick={sendAllDrafts} loading={busy === "send-all"}>Gửi {drafts} phiếu nháp</KinButton>}
      </div>

      {!hasAccount && !loading && (
        <div role="alert" className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
          Bạn chưa lưu tài khoản nhận tiền nên phiếu chưa có mã QR.{" "}
          <button className="underline font-semibold" onClick={onGoPayout}>Cài đặt nhận tiền →</button>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="rounded-xl p-4 text-sm" style={CARD_STYLE}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Chưa lập được cho {skipped.length} em</p>
            <button onClick={() => setSkipped([])} className="text-xs underline" style={{ color: "var(--kin-chu-phu)" }} aria-label="Ẩn danh sách bỏ qua">Ẩn</button>
          </div>
          <ul className="mt-2 space-y-1" style={{ color: "var(--kin-chu-phu)" }}>
            {skipped.map(s => <li key={s.studentId}><b>{s.studentName}</b>: {s.reason}</li>)}
          </ul>
        </div>
      )}

      {summary && !failed && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([["Số phiếu", String(summary.count)], ["Phải thu", vnd(summary.totalDue)], ["Đã thu", vnd(summary.totalPaid)], ["Còn lại", vnd(summary.totalRemaining)]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl p-3" style={CARD_STYLE}>
              <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{k}</dt>
              <dd className="text-lg font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>
      ) : failed ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được danh sách phiếu. <button className="underline font-semibold" onClick={() => load(yearMonth)}>Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <div role="status" className="rounded-xl p-8 text-center text-sm" style={{ ...CARD_STYLE, borderStyle: "dashed", color: "var(--kin-chu-phu)" }}>
          Chưa có phiếu nào cho {monthLabel(yearMonth)}. Nhập số buổi của lớp (ở trang quản khoá) rồi bấm “Lập phiếu cả lớp”.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(i => (
            <li key={i.id} className="rounded-xl p-4" style={CARD_STYLE}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{i.studentName}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{i.code}</p>
                </div>
                <div className="text-right">
                  <Badge tone={invoiceTone(i.status)}>{i.statusLabel}</Badge>
                  {i.needsBankCheck && <p className="text-xs mt-1 font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Quá 24 giờ chưa thấy tiền — kiểm sao kê</p>}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Phải đóng</dt><dd className="font-bold tabular-nums">{vnd(i.amountDue)}</dd></div>
                <div><dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Đã nhận</dt><dd className="font-bold tabular-nums">{vnd(i.paidAmount)}</dd></div>
                <div><dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Còn lại</dt><dd className="font-bold tabular-nums">{vnd(i.remaining)}</dd></div>
              </dl>
              {(i.zaloOpenedAt || i.parentViewedAt) && (
                <p className="text-xs mt-2 flex gap-x-4 gap-y-1 flex-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                  {i.zaloOpenedAt && <span>Đã mở Zalo lúc {vnWhen(i.zaloOpenedAt)}</span>}
                  {i.parentViewedAt && <span style={{ color: "var(--kin-tt-chu-xong)" }}>Phụ huynh đã xem lúc {vnWhen(i.parentViewedAt)}</span>}
                </p>
              )}
              {i.creditApplied > 0 && <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>Đã trừ {vnd(i.creditApplied)} tiền đóng dư từ tháng trước.</p>}
              {i.status === "cancelled" && i.cancelReason && <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>Lý do huỷ: {i.cancelReason}</p>}
              <div className="mt-3 flex gap-2 flex-wrap">
                {i.status === "draft" && <KinButton size="md" loading={busy === i.id} onClick={() => act(i, { action: "send" }, "Đã gửi phiếu.")}>Gửi phiếu</KinButton>}
                {(i.status === "sent" || i.status === "parent_reported" || i.status === "partial") && (<>
                  <KinButton variant="secondary" onClick={() => setDialog({ kind: "pay", inv: i })}>Đã nhận tiền</KinButton>
                  <KinButton onClick={() => setDialog({ kind: "zalo", inv: i })}>{i.zaloOpenedAt ? "Gửi lại qua Zalo" : "Gửi phiếu qua Zalo"}</KinButton>
                  <KinButton variant="secondary" onClick={() => copyMessage(i)}>Sao chép tin nhắn</KinButton>
                </>)}
                {i.status === "draft" && <KinButton variant="secondary" onClick={() => copyMessage(i)}>Sao chép tin nhắn</KinButton>}
                {i.status !== "paid" && i.status !== "cancelled" && <KinButton variant="ghost" onClick={() => setDialog({ kind: "amount", inv: i })}>Sửa số tiền</KinButton>}
                {i.status !== "cancelled" && <KinButton variant="ghost" onClick={() => setDialog({ kind: "cancel", inv: i })}>Huỷ phiếu</KinButton>}
                {i.status === "cancelled" && <KinButton variant="secondary" loading={busy === i.id} onClick={() => act(i, { action: "restore" }, "Đã khôi phục phiếu về nháp.")}>Khôi phục</KinButton>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === "amount" && <AmountDialog inv={dialog.inv} onClose={() => setDialog(null)}
        onSubmit={async (amountDue, reason) => { if (await act(dialog.inv, { action: "set_amount", amountDue, reason }, "Đã cập nhật số tiền. Mã phiếu giữ nguyên.")) setDialog(null); }} />}
      {dialog?.kind === "cancel" && <ReasonDialog title={`Huỷ phiếu ${dialog.inv.code}`} label="Lý do huỷ (bắt buộc)" cta="Huỷ phiếu" danger onClose={() => setDialog(null)}
        onSubmit={async reason => { if (await act(dialog.inv, { action: "cancel", reason }, "Đã huỷ phiếu.")) setDialog(null); }} />}
      {dialog?.kind === "zalo" && <ZaloDialog inv={dialog.inv} onClose={() => setDialog(null)} onOpened={() => load(yearMonth)} />}
      {dialog?.kind === "pay" && <PayDialog inv={dialog.inv} onClose={() => setDialog(null)}
        onSubmit={async (amount, excess) => { if (await act(dialog.inv, { action: "record_payment", amount, ...(excess ? { excess } : {}) }, "Đã ghi nhận tiền.")) setDialog(null); }} />}
    </div>
  );
}

function AmountDialog({ inv, onClose, onSubmit }: { inv: InvoiceRow; onClose: () => void; onSubmit: (amount: number, reason: string) => Promise<void> }) {
  const [amount, setAmount] = useState(String(inv.amountDue));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 0 && reason.trim().length > 0;
  return (
    <Modal title={`Sửa số tiền phiếu ${inv.code}`} onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>Mã phiếu không đổi. Lý do sẽ hiện trên phiếu phụ huynh.</p>
      <label className="block text-sm mb-1" htmlFor="amt">Số tiền phải đóng (đ)</label>
      <input id="amt" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="w-full px-3 py-2 rounded-lg mb-3 min-h-[44px]" style={FIELD_STYLE} />
      <label className="block text-sm mb-1" htmlFor="why">Lý do điều chỉnh</label>
      <input id="why" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: em vào lớp giữa tháng" className="w-full px-3 py-2 rounded-lg mb-4 min-h-[44px]" style={FIELD_STYLE} />
      <div className="flex justify-end gap-2">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        <KinButton disabled={!valid} loading={busy} onClick={async () => { setBusy(true); await onSubmit(n, reason.trim()); setBusy(false); }}>Lưu</KinButton>
      </div>
    </Modal>
  );
}

export function ReasonDialog({ title, label, cta, danger, onClose, onSubmit }: { title: string; label: string; cta: string; danger?: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <label className="block text-sm mb-1" htmlFor="reason">{label}</label>
      <textarea id="reason" value={reason} maxLength={300} rows={3} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg mb-4" style={FIELD_STYLE} />
      <div className="flex justify-end gap-2">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        <KinButton disabled={!reason.trim()} loading={busy} onClick={async () => { setBusy(true); await onSubmit(reason.trim()); setBusy(false); }}
          style={danger ? { background: "var(--kin-tt-chu-loi)", borderColor: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" } : undefined}>{cta}</KinButton>
      </div>
    </Modal>
  );
}

interface ZaloPrepared { target: "private" | "group"; yearMonth: string; studentName: string; parentName: string | null; amount: number; path: string | null; expiresAt: string | null; phone: string | null }

// TT-199 giai đoạn 1: soạn tin sẵn, gia sư sửa được, rồi tự bấm gửi trong Zalo. KiN không gửi giúp.
function ZaloDialog({ inv, onClose, onOpened }: { inv: InvoiceRow; onClose: () => void; onOpened: () => Promise<void> | void }) {
  const notify = useNotify();
  const [target, setTarget] = useState<"private" | "group">("private");
  const [prep, setPrep] = useState<ZaloPrepared | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const prepare = useCallback(async (t: "private" | "group") => {
    await Promise.resolve();
    const my = ++seq.current;
    setState("loading"); setErr("");
    const r = await callApi<ZaloPrepared>(`/api/tutor/invoices/${inv.id}/zalo`, { method: "POST", body: JSON.stringify({ action: "prepare", target: t }) });
    if (my !== seq.current) return; // bỏ kết quả cũ khi đổi lựa chọn nhanh
    if (!r.ok) { setErr(r.data.error ?? "Không chuẩn bị được tin nhắn"); setState("error"); return; }
    setPrep(r.data);
    setText(t === "group"
      ? groupInvoiceMessage({ yearMonth: r.data.yearMonth })
      : privateInvoiceMessage({ studentName: r.data.studentName, yearMonth: r.data.yearMonth, amount: r.data.amount, url: `${window.location.origin}${r.data.path}` }));
    setState("ready");
  }, [inv.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void prepare(target);
  }, [prepare, target]);

  async function open() {
    if (!prep || !text.trim()) return;
    setBusy(true);
    const res = await openZalo({ text, phone: target === "private" ? prep.phone : null });
    if (!res.opened) { setBusy(false); if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    if (target === "private") {
      const log = await callApi(`/api/tutor/invoices/${inv.id}/zalo`, { method: "POST", body: JSON.stringify({ action: "opened" }) });
      if (!log.ok) notify.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    }
    notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setBusy(false);
    await onOpened();
    onClose();
  }

  const daysLeft = prep?.expiresAt ? invoiceLinkDaysLeft(new Date(prep.expiresAt), new Date()) : null;
  return (
    <Modal title={`Gửi phiếu qua Zalo — ${inv.studentName}`} onClose={onClose}>
      <fieldset className="mb-3 text-sm">
        <legend className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Gửi vào đâu?</legend>
        {([["private", "Chat riêng với phụ huynh"], ["group", "Nhóm Zalo lớp"]] as const).map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="zalo-target" checked={target === v} onChange={() => setTarget(v)} /> {l}</label>
        ))}
      </fieldset>
      {state === "loading" && <p role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang chuẩn bị tin nhắn…</p>}
      {state === "error" && <p role="alert" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p>}
      {state === "ready" && prep && (<>
        <label className="block text-sm" htmlFor="tin-phieu">Tin nhắn (sửa được trước khi gửi)</label>
        <textarea id="tin-phieu" rows={6} value={text} onChange={e => setText(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
        <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
          {target === "group"
            ? "Tin chung cho nhóm: không có số tiền, link hay tên con, vì ai trong nhóm cũng xem được. Phiếu từng em gửi riêng ở chat riêng."
            : <>
                {prep.phone ? `Sẽ mở Zalo của ${prep.phone}.` : "Chưa có số điện thoại phụ huynh — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận."}
                {daysLeft !== null && <> Link phiếu dùng được {daysLeft} ngày nữa, phụ huynh không cần tài khoản.</>}
              </>}
          {" "}KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
        </p>
      </>)}
      <div className="flex gap-2 flex-wrap mt-4 justify-end">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        <KinButton variant="secondary" disabled={state !== "ready" || !text.trim()} onClick={async () => { if (await copyText(text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
        <KinButton loading={busy} disabled={state !== "ready" || !text.trim()} onClick={() => void open()}>Mở Zalo</KinButton>
      </div>
    </Modal>
  );
}

function PayDialog({ inv, onClose, onSubmit }: { inv: InvoiceRow; onClose: () => void; onSubmit: (amount: number, excess?: "credit" | "refunded") => Promise<void> }) {
  const [amount, setAmount] = useState(String(inv.remaining));
  const [excess, setExcess] = useState<"credit" | "refunded">("credit");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const over = Number.isInteger(n) && n > inv.remaining ? n - inv.remaining : 0;
  const valid = Number.isInteger(n) && n > 0;
  return (
    <Modal title={`Ghi nhận tiền — ${inv.studentName}`} onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>Dùng khi nhận tiền mặt hoặc chuyển khoản không qua SePay. Còn lại {vnd(inv.remaining)}.</p>
      <label className="block text-sm mb-1" htmlFor="payamt">Số tiền đã nhận (đ)</label>
      <input id="payamt" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="w-full px-3 py-2 rounded-lg mb-3 min-h-[44px]" style={FIELD_STYLE} />
      {over > 0 && (
        <fieldset className="mb-3 text-sm">
          <legend className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Dư {vnd(over)} — xử lý thế nào?</legend>
          {([["credit", "Trừ vào tháng sau"], ["refunded", "Đã trả lại phụ huynh"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="excess" checked={excess === v} onChange={() => setExcess(v)} /> {l}</label>
          ))}
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        <KinButton disabled={!valid} loading={busy} onClick={async () => { setBusy(true); await onSubmit(n, over > 0 ? excess : undefined); setBusy(false); }}>Ghi nhận</KinButton>
      </div>
    </Modal>
  );
}
