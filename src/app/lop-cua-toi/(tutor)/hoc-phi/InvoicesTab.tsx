// TT-200 — tab "Phiếu": lập phiếu cả lớp, gửi, sửa số tiền, ghi tiền mặt, huỷ.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton, KinMoney } from "@/components/kin";
import Link from "next/link";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/Button";
import { openZalo } from "@/lib/zaloShare";
import { groupInvoiceMessage, invoiceLinkDaysLeft, privateInvoiceMessage } from "@/lib/invoiceZalo";
import { HISTORY_LABEL, dueDateLabel, reminderMessage, type HistoryEvent, type ReminderStep } from "@/lib/invoiceReminder";
import { Badge, FIELD_STYLE, Modal, callApi, copyText, invoiceTone, monthLabel, useNotify, vnd } from "@/components/tutor/shared";
import { vnMonthKey } from "@/lib/revenue";
import { LATE_FEE_HINT_TEXT } from "@/lib/lateFeeHint";
import { PaymentsDialog } from "./PaymentTools";
import { AttachDialog, DiscountDialog } from "./LooseAndDiscount";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/tuitionPayment";
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
  looseCount: number; looseTotal: number; // HP-24: khoản phí rời có thể gộp vào phiếu nháp
  // F2: hạn đóng ("YYYY-MM-DD"), số ngày quá hạn, bước nhắc đã tới lúc (2|3|null), bước cao nhất đã mở Zalo, số lần nhắc bước 2–3 đã ghi.
  dueDate: string | null; overdueDays: number; nextStep: 2 | 3 | null; lastStep: number; proStepsLogged: number;
  lateFeeHint?: boolean; // HP-28: chỉ gợi ý chữ trên phiếu quá hạn, KiN không tự cộng tiền
}
interface Summary { count: number; totalDue: number; totalPaid: number; totalRemaining: number; overdueCount?: number; overdueRemaining?: number }
type Dialog =
  | { kind: "amount"; inv: InvoiceRow }
  | { kind: "cancel"; inv: InvoiceRow }
  | { kind: "pay"; inv: InvoiceRow }
  | { kind: "payments"; inv: InvoiceRow }
  | { kind: "attach"; inv: InvoiceRow }
  | { kind: "discount" }
  | { kind: "zalo"; inv: InvoiceRow; step: ReminderStep }
  | { kind: "due"; inv: InvoiceRow }
  | { kind: "history"; inv: InvoiceRow };

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
  const [reminderPro, setReminderPro] = useState(true); // F2: cổng tắt → true cho mọi người
  const [defaultDue, setDefaultDue] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [lateHintOn, setLateHintOn] = useState(true); // HP-28
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
    const r = await callApi<{ items: InvoiceRow[]; summary: Summary; hasPayoutAccount: boolean; reminderPro: boolean; defaultDueDate: string; lateFeeHintEnabled?: boolean }>(`/api/tutor/invoices?yearMonth=${ym}`);
    if (my !== seq.current) return; // bỏ kết quả cũ khi đổi tháng nhanh
    if (!r.ok) setFailed(true);
    else { setItems(r.data.items); setSummary(r.data.summary); setHasAccount(r.data.hasPayoutAccount); setReminderPro(r.data.reminderPro !== false); setDefaultDue(r.data.defaultDueDate ?? ""); setLateHintOn(r.data.lateFeeHintEnabled !== false); }
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

  async function toggleLateHint(next: boolean) {
    setLateHintOn(next);
    const r = await callApi<{ enabled?: boolean }>("/api/tutor/late-fee-hint", { method: "PUT", body: JSON.stringify({ enabled: next }) });
    if (!r.ok) { setLateHintOn(!next); notify.err(r.data.error ?? "Chưa lưu được cài đặt."); return; }
    await load(yearMonth);
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
  const isOverdue = (i: InvoiceRow) => i.overdueDays > 0 && i.remaining > 0 && i.status !== "cancelled" && i.status !== "paid";
  const shown = onlyOverdue ? items.filter(isOverdue) : items;
  const lockedHint = !reminderPro && items.some(i => i.status === "sent" || i.status === "partial");

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Tháng
          <select value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <KinButton onClick={issue} loading={busy === "issue"}>Lập phiếu cả lớp</KinButton>
        <KinButton variant="ghost" onClick={() => setDialog({ kind: "discount" })}>Giảm giá %</KinButton>
        {drafts > 0 && <KinButton variant="secondary" onClick={sendAllDrafts} loading={busy === "send-all"}>Gửi {drafts} phiếu nháp</KinButton>}
      </div>

      {!hasAccount && !loading && (
        <div role="alert">
          <KinCallout title="Chưa có tài khoản nhận tiền">
            Bạn chưa lưu tài khoản nhận tiền nên phiếu chưa có mã QR.{" "}
            <button className="underline font-medium text-[var(--kin-nhan-link)]" onClick={onGoPayout}>Cài đặt nhận tiền →</button>
          </KinCallout>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="text-sm px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-vien-thuong)]">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Chưa lập được cho {skipped.length} em</p>
            <button onClick={() => setSkipped([])} className="text-xs underline min-h-11 px-2" style={{ color: "var(--kin-chu-mo)" }} aria-label="Ẩn danh sách bỏ qua">Ẩn</button>
          </div>
          <ul className="mt-2 space-y-1" style={{ color: "var(--kin-chu-phu)" }}>
            {skipped.map(s => <li key={s.studentId}><b>{s.studentName}</b>: {s.reason}</li>)}
          </ul>
        </div>
      )}

      {summary && !failed && (
        <KinStatRow>
          <KinStat label="Số phiếu" value={String(summary.count)} />
          <KinStat label="Phải thu" value={<KinMoney>{vnd(summary.totalDue)}</KinMoney>} />
          <KinStat label="Đã thu" value={<KinMoney>{vnd(summary.totalPaid)}</KinMoney>} />
          <KinStat label="Còn lại" value={<KinMoney>{vnd(summary.totalRemaining)}</KinMoney>} />
          {(summary.overdueCount ?? 0) > 0 && <KinStat label="Quá hạn" value={`${summary.overdueCount} phiếu`} hint={<>Còn <KinMoney>{vnd(summary.overdueRemaining ?? 0)}</KinMoney></>} />}
        </KinStatRow>
      )}

      {(summary?.overdueCount ?? 0) > 0 && !failed && (
        <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)] min-h-[44px]" style={{ color: "var(--kin-chu-phu)" }}>
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} /> Chỉ xem phiếu quá hạn đóng ({summary?.overdueCount})
        </label>
      )}
      {(summary?.overdueCount ?? 0) > 0 && !failed && (
        <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)] min-h-[44px]" style={{ color: "var(--kin-chu-phu)" }}>
          <input type="checkbox" checked={lateHintOn} onChange={e => void toggleLateHint(e.target.checked)} /> Hiện gợi ý phí trễ hạn trên phiếu quá hạn (chỉ là gợi ý, KiN không tự cộng tiền)
        </label>
      )}

      {lockedHint && !loading && !failed && (
        <p className="text-[length:var(--kin-co-goc)] px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-vien-thuong)]" style={{ color: "var(--kin-chu-phu)" }}>
          Công nợ, phiếu quá hạn và bước 1 (tin soạn sẵn, mở Zalo) luôn miễn phí. Đặt hạn đóng từng phiếu, nhắc bước 2–3 và lịch sử nhắc có trong KiN Pro.{" "}
          <Link href="/lop-cua-toi/goi" className="underline font-medium text-[var(--kin-nhan-link)]">Xem gói</Link>
        </p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải danh sách phiếu">{[0, 1, 2].map(i => <div key={i} className="h-[76px] rounded kin-skel kin-skel--soft" />)}</div>
      ) : failed ? (
        <div role="alert" className="py-8 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
          Không tải được danh sách phiếu.{" "}
          <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={() => load(yearMonth)}>Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <KinEmptyState title={`Chưa có phiếu nào cho ${monthLabel(yearMonth)}`}
          action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Mở Lớp</Link>}>
          Nhập số buổi của lớp (ở trang quản khoá) rồi bấm “Lập phiếu cả lớp”.
        </KinEmptyState>
      ) : (
        <ul className="border-t border-[var(--kin-vien-nhat)]">
          {shown.length === 0 && <li className="py-6 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-phu)" }}>Không có phiếu nào quá hạn đóng trong tháng này.</li>}
          {shown.map(i => (
            <li key={i.id} className="py-5 border-b border-[var(--kin-vien-nhat)]">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[length:var(--kin-co-tieu-de)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{i.studentName}</p>
                  <p className="text-[length:var(--kin-co-goc)] font-mono mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{i.code}</p>
                </div>
                <div className="text-right">
                  <Badge tone={invoiceTone(i.status)}>{i.statusLabel}</Badge>
                  {i.needsBankCheck && <p className="text-xs mt-1 font-medium" style={{ color: "var(--kin-tt-chu-cho)" }}>Quá 24 giờ chưa thấy tiền — kiểm sao kê</p>}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4 text-[length:var(--kin-co-goc)]">
                <div><dt className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Phải đóng</dt><dd className="font-medium tabular-nums"><KinMoney>{vnd(i.amountDue)}</KinMoney></dd></div>
                <div><dt className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Đã nhận</dt><dd className="font-medium tabular-nums"><KinMoney>{vnd(i.paidAmount)}</KinMoney></dd></div>
                <div><dt className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Còn lại</dt><dd className="font-medium tabular-nums"><KinMoney>{vnd(i.remaining)}</KinMoney></dd></div>
              </dl>
              {i.dueDate && i.status !== "cancelled" && (
                <p className="text-xs mt-2" style={{ color: isOverdue(i) ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-phu)" }}>
                  Hạn đóng {dueDateLabel(i.dueDate)}{isOverdue(i) ? ` · quá hạn ${i.overdueDays} ngày` : ""}
                </p>
              )}
              {i.lateFeeHint && <p data-late-fee-hint className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>{LATE_FEE_HINT_TEXT}</p>}
              {(i.zaloOpenedAt || i.parentViewedAt) && (
                <p className="text-xs mt-2 flex gap-x-4 gap-y-1 flex-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                  {i.zaloOpenedAt && <span>Đã mở Zalo lúc {vnWhen(i.zaloOpenedAt)}</span>}
                  {i.parentViewedAt && <span style={{ color: "var(--kin-tt-chu-xong)" }}>Phụ huynh đã xem lúc {vnWhen(i.parentViewedAt)}</span>}
                </p>
              )}
              {i.creditApplied > 0 && <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>Đã trừ <KinMoney>{vnd(i.creditApplied)}</KinMoney> tiền đóng dư từ tháng trước.</p>}
              {i.status === "cancelled" && i.cancelReason && <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>Lý do huỷ: {i.cancelReason}</p>}
              <div className="mt-4 flex gap-2 flex-wrap">
                {i.status === "draft" && <KinButton size="md" loading={busy === i.id} onClick={() => act(i, { action: "send" }, "Đã gửi phiếu.")}>Gửi phiếu</KinButton>}
                {(i.status === "sent" || i.status === "parent_reported" || i.status === "partial") && (<>
                  <KinButton variant="secondary" onClick={() => setDialog({ kind: "pay", inv: i })}>Đã nhận tiền</KinButton>
                  <KinButton onClick={() => setDialog({ kind: "zalo", inv: i, step: 1 })}>{i.zaloOpenedAt ? "Gửi lại qua Zalo" : "Gửi phiếu qua Zalo"}</KinButton>
                  <KinButton variant="secondary" onClick={() => copyMessage(i)}>Sao chép tin nhắn</KinButton>
                  {reminderPro && (i.status === "sent" || i.status === "partial") && i.lastStep >= 1 && i.lastStep < 3 && (
                    <KinButton variant={i.nextStep === i.lastStep + 1 ? "primary" : "secondary"} onClick={() => setDialog({ kind: "zalo", inv: i, step: (i.lastStep + 1) as ReminderStep })}>
                      Nhắc bước {i.lastStep + 1}{i.nextStep === i.lastStep + 1 ? " (đến lúc)" : ""}
                    </KinButton>
                  )}
                </>)}
                {reminderPro && i.status !== "paid" && i.status !== "cancelled" && (
                  <KinButton variant="ghost" onClick={() => setDialog({ kind: "due", inv: i })}>{i.dueDate ? "Đổi hạn đóng" : "Đặt hạn đóng"}</KinButton>
                )}
                {(reminderPro || i.proStepsLogged > 0) && (i.zaloOpenedAt || i.proStepsLogged > 0) && (
                  <KinButton variant="ghost" onClick={() => setDialog({ kind: "history", inv: i })}>Lịch sử nhắc</KinButton>
                )}
                {i.status === "draft" && <KinButton variant="secondary" onClick={() => copyMessage(i)}>Sao chép tin nhắn</KinButton>}
                {i.paidAmount > 0 && <KinButton variant="ghost" onClick={() => setDialog({ kind: "payments", inv: i })}>Khoản đã thu</KinButton>}
                {i.status === "draft" && i.looseCount > 0 && <KinButton variant="secondary" onClick={() => setDialog({ kind: "attach", inv: i })}>Gộp {i.looseCount} khoản rời (<KinMoney>{vnd(i.looseTotal)}</KinMoney>)</KinButton>}
                {i.status !== "paid" && i.status !== "cancelled" && <KinButton variant="ghost" onClick={() => setDialog({ kind: "amount", inv: i })}>Sửa số tiền</KinButton>}
                {i.status !== "cancelled" && <KinButton variant="ghost" onClick={() => setDialog({ kind: "cancel", inv: i })}>Huỷ phiếu</KinButton>}
                {i.status === "cancelled" && <KinButton variant="secondary" loading={busy === i.id} onClick={() => act(i, { action: "restore" }, "Đã khôi phục phiếu về nháp.")}>Khôi phục</KinButton>}
              </div>
              {!reminderPro && (i.status === "sent" || i.status === "partial") && i.lastStep >= 1 && (
                <div className="mt-3 flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--kin-chu-mo)" }}>
                  <span aria-hidden className="select-none opacity-50 blur-[1.5px]">Nhắc bước 2 · Nhắc bước 3 · Hạn đóng · Lịch sử nhắc</span>
                  <span>Có trong KiN Pro</span>
                  <Link href="/lop-cua-toi/goi" className={kinButtonClass("secondary")}>Xem gói</Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === "amount" && <AmountDialog inv={dialog.inv} onClose={() => setDialog(null)}
        onSubmit={async (amountDue, reason) => { if (await act(dialog.inv, { action: "set_amount", amountDue, reason }, "Đã cập nhật số tiền. Mã phiếu giữ nguyên.")) setDialog(null); }} />}
      {dialog?.kind === "cancel" && <ReasonDialog title={`Huỷ phiếu ${dialog.inv.code}`} label="Lý do huỷ (bắt buộc)" cta="Huỷ phiếu" danger onClose={() => setDialog(null)}
        onSubmit={async reason => { if (await act(dialog.inv, { action: "cancel", reason }, "Đã huỷ phiếu.")) setDialog(null); }} />}
      {dialog?.kind === "zalo" && <ZaloDialog inv={dialog.inv} step={dialog.step} onClose={() => setDialog(null)} onOpened={() => load(yearMonth)} />}
      {dialog?.kind === "due" && <DueDialog inv={dialog.inv} suggested={defaultDue} onClose={() => setDialog(null)}
        onSubmit={async dueDate => { if (await act(dialog.inv, { action: "set_due_date", dueDate }, dueDate ? "Đã đặt hạn đóng." : "Đã xoá hạn đóng.")) setDialog(null); }} />}
      {dialog?.kind === "history" && <HistoryDialog inv={dialog.inv} onClose={() => setDialog(null)} />}
      {dialog?.kind === "pay" && <PayDialog inv={dialog.inv} onClose={() => setDialog(null)}
        onSubmit={async (amount, excess, paidOn, method) => { if (await act(dialog.inv, { action: "record_payment", amount, paidOn, method, ...(excess ? { excess } : {}) }, "Đã ghi nhận tiền.")) setDialog(null); }} />}
      {dialog?.kind === "attach" && <AttachDialog invoiceId={dialog.inv.id} code={dialog.inv.code} studentName={dialog.inv.studentName} onClose={() => setDialog(null)} onDone={() => load(yearMonth)} />}
      {dialog?.kind === "discount" && <DiscountDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "payments" && <PaymentsDialog invoiceId={dialog.inv.id} code={dialog.inv.code} studentName={dialog.inv.studentName} onClose={() => setDialog(null)} onChanged={() => load(yearMonth)} />}
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

interface ZaloPrepared { target: "private" | "group"; yearMonth: string; studentName: string; parentName: string | null; amount: number; path: string | null; expiresAt: string | null; phone: string | null; dueDate: string | null; step: ReminderStep }

// TT-199 giai đoạn 1: soạn tin sẵn, gia sư sửa được, rồi tự bấm gửi trong Zalo. KiN không gửi giúp.
function ZaloDialog({ inv, step, onClose, onOpened }: { inv: InvoiceRow; step: ReminderStep; onClose: () => void; onOpened: () => Promise<void> | void }) {
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
    const r = await callApi<ZaloPrepared>(`/api/tutor/invoices/${inv.id}/zalo`, { method: "POST", body: JSON.stringify({ action: "prepare", target: t, step }) });
    if (my !== seq.current) return; // bỏ kết quả cũ khi đổi lựa chọn nhanh
    if (!r.ok) { setErr(r.data.error ?? "Không chuẩn bị được tin nhắn"); setState("error"); return; }
    setPrep(r.data);
    const url = `${window.location.origin}${r.data.path}`;
    setText(t === "group"
      ? groupInvoiceMessage({ yearMonth: r.data.yearMonth, dueDate: r.data.dueDate })
      : step === 1
        ? privateInvoiceMessage({ studentName: r.data.studentName, yearMonth: r.data.yearMonth, amount: r.data.amount, url, dueDate: r.data.dueDate })
        : reminderMessage(step, { studentName: r.data.studentName, yearMonth: r.data.yearMonth, amount: r.data.amount, url, dueDate: r.data.dueDate }));
    setState("ready");
  }, [inv.id, step]);

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
      const log = await callApi(`/api/tutor/invoices/${inv.id}/zalo`, { method: "POST", body: JSON.stringify({ action: "opened", step }) });
      if (!log.ok) notify.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    }
    notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setBusy(false);
    await onOpened();
    onClose();
  }

  const daysLeft = prep?.expiresAt ? invoiceLinkDaysLeft(new Date(prep.expiresAt), new Date()) : null;
  return (
    <Modal title={step === 1 ? `Gửi phiếu qua Zalo — ${inv.studentName}` : `Nhắc bước ${step} qua Zalo — ${inv.studentName}`} onClose={onClose}>
      {step === 1 ? <fieldset className="mb-3 text-sm">
        <legend className="font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Gửi vào đâu?</legend>
        {([["private", "Chat riêng với phụ huynh"], ["group", "Nhóm Zalo lớp"]] as const).map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="zalo-target" checked={target === v} onChange={() => setTarget(v)} /> {l}</label>
        ))}
      </fieldset> : <p className="mb-3 text-sm" style={{ color: "var(--kin-chu-phu)" }}>Tin nhắc nhẹ nhàng, chỉ gửi riêng cho phụ huynh. Bạn sửa tin rồi tự bấm gửi trong Zalo.</p>}
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

function PayDialog({ inv, onClose, onSubmit }: { inv: InvoiceRow; onClose: () => void; onSubmit: (amount: number, excess: "credit" | "refunded" | undefined, paidOn: string, method: PaymentMethod) => Promise<void> }) {
  const today = vnDateKeyOf(new Date());
  const [amount, setAmount] = useState(String(inv.remaining));
  const [excess, setExcess] = useState<"credit" | "refunded">("credit");
  const [paidOn, setPaidOn] = useState(today); // HP-20: ngày thu (mặc định hôm nay, giờ VN)
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const over = Number.isInteger(n) && n > inv.remaining ? n - inv.remaining : 0;
  const valid = Number.isInteger(n) && n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(paidOn) && paidOn <= today;
  return (
    <Modal title={`Ghi nhận tiền — ${inv.studentName}`} onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>Dùng khi nhận tiền mặt hoặc chuyển khoản không qua SePay. Còn lại {vnd(inv.remaining)}.</p>
      <label className="block text-sm mb-1" htmlFor="payamt">Số tiền đã nhận (đ)</label>
      <input id="payamt" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="w-full px-3 py-2 rounded-lg mb-3 min-h-[44px]" style={FIELD_STYLE} />
      <label className="block text-sm mb-1" htmlFor="paidon">Ngày thu</label>
      <input id="paidon" type="date" value={paidOn} max={today} onChange={e => setPaidOn(e.target.value)} className="w-full px-3 py-2 rounded-lg mb-3 min-h-[44px]" style={FIELD_STYLE} />
      <fieldset className="mb-3 text-sm">
        <legend className="font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Hình thức</legend>
        {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(v => (
          <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="pay-method" checked={method === v} onChange={() => setMethod(v)} /> {PAYMENT_METHOD_LABEL[v]}</label>
        ))}
      </fieldset>
      {over > 0 && (
        <fieldset className="mb-3 text-sm">
          <legend className="font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Dư {vnd(over)} — xử lý thế nào?</legend>
          {([["credit", "Trừ vào tháng sau"], ["refunded", "Đã trả lại phụ huynh"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]"><input type="radio" name="excess" checked={excess === v} onChange={() => setExcess(v)} /> {l}</label>
          ))}
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        <KinButton disabled={!valid} loading={busy} onClick={async () => { setBusy(true); await onSubmit(n, over > 0 ? excess : undefined, paidOn, method); setBusy(false); }}>Ghi nhận</KinButton>
      </div>
    </Modal>
  );
}

// F2 (KiN Pro): hạn đóng của một phiếu. Chỉ để nhắc và hiện cho phụ huynh; không đổi số tiền hay trạng thái phiếu.
function DueDialog({ inv, suggested, onClose, onSubmit }: { inv: InvoiceRow; suggested: string; onClose: () => void; onSubmit: (dueDate: string | null) => Promise<void> }) {
  const [value, setValue] = useState(inv.dueDate ?? suggested);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return (
    <Modal title={`Hạn đóng — ${inv.studentName}`} onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>
        Phụ huynh thấy hạn này trên phiếu, và tin Zalo ghi đúng hạn này. Hạn chỉ để nhắc: KiN không tự tính phí trễ hay đổi số tiền. Chưa đặt thì tin vẫn ghi “hạn trước ngày 20”.
      </p>
      <label className="block text-sm mb-1" htmlFor="due-date">Hạn đóng</label>
      <input id="due-date" type="date" value={value} onChange={e => setValue(e.target.value)} className="w-full px-3 py-2 rounded-lg mb-4 min-h-[44px]" style={FIELD_STYLE} />
      <div className="flex justify-end gap-2 flex-wrap">
        <KinButton variant="ghost" onClick={onClose}>Đóng</KinButton>
        {inv.dueDate && <KinButton variant="secondary" loading={busy} onClick={async () => { setBusy(true); await onSubmit(null); setBusy(false); }}>Xoá hạn</KinButton>}
        <KinButton disabled={!valid} loading={busy} onClick={async () => { setBusy(true); await onSubmit(value); setBusy(false); }}>Lưu hạn</KinButton>
      </div>
    </Modal>
  );
}

interface HistoryData { code: string; dueDate: string | null; overdueDays: number; matched: boolean; events: HistoryEvent[] }
// F2 (KiN Pro): lịch sử nhắc của một phiếu. Chỉ ghi những gì KiN biết: bạn bấm mở Zalo lúc nào, phụ huynh bấm “Tôi đã chuyển” lúc nào, tiền đã ghi vào phiếu chưa.
function HistoryDialog({ inv, onClose }: { inv: InvoiceRow; onClose: () => void }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    await Promise.resolve();
    setState("loading");
    const r = await callApi<HistoryData>(`/api/tutor/invoices/${inv.id}/reminders`);
    if (!r.ok) { setErr(r.data.error ?? "Không tải được lịch sử nhắc"); setState("error"); return; }
    setData(r.data); setState("ready");
  }, [inv.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return (
    <Modal title={`Lịch sử nhắc — ${inv.studentName}`} onClose={onClose}>
      {state === "loading" && <p role="status" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tải lịch sử nhắc…</p>}
      {state === "error" && (
        <div role="alert" className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>
          {err} <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={() => void load()}>Thử lại</button>
        </div>
      )}
      {state === "ready" && data && (<>
        <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>
          Phiếu {data.code}. “Đã mở Zalo” nghĩa là bạn đã bấm mở Zalo; KiN không biết tin có đi thật hay không.
          {data.dueDate && <> Hạn đóng {dueDateLabel(data.dueDate)}{data.overdueDays > 0 ? `, quá hạn ${data.overdueDays} ngày` : ""}.</>}
        </p>
        {data.events.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Chưa có lần nhắc nào được ghi cho phiếu này.</p>
        ) : (
          <ol className="text-sm space-y-2">
            {data.events.map((e, idx) => (
              <li key={`${e.kind}-${e.at}-${idx}`} className="flex gap-3 justify-between flex-wrap">
                <span style={{ color: "var(--kin-chu-chinh)" }}>{HISTORY_LABEL[e.kind]}{e.step ? ` · bước ${e.step}` : ""}{e.kind === "matched" && e.amount ? ` · ${vnd(e.amount)}` : ""}</span>
                <span className="tabular-nums" style={{ color: "var(--kin-chu-phu)" }}>{vnWhen(e.at)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-sm mt-3 font-medium" style={{ color: data.matched ? "var(--kin-tt-chu-xong)" : "var(--kin-chu-phu)" }}>
          {data.matched ? "Đã có tiền ghi vào phiếu." : "Chưa có tiền ghi vào phiếu."}
        </p>
      </>)}
      <div className="flex justify-end mt-4"><KinButton variant="ghost" onClick={onClose}>Đóng</KinButton></div>
    </Modal>
  );
}
