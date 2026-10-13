// TT-200 — thẻ phiếu học phí cho phụ huynh/học viên. QR VietQR trỏ vào tài khoản
// của GIA SƯ ra phiếu (không phải của KiN). "Tôi đã chuyển" chỉ báo cho gia sư —
// chưa phải đã nhận tiền; gia sư xác nhận khi thấy tiền vào.
"use client";
import { useState } from "react";
import type { PartyInvoiceView } from "@/lib/invoiceServer";

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `Tháng ${Number(m)}/${y}`; };

export default function InvoiceCard({ invoice, reportUrl }: { invoice: PartyInvoiceView; reportUrl: string }) {
  const [status, setStatus] = useState(invoice.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const paid = status === "paid";
  const reported = status === "parent_reported";
  const canReport = (status === "sent" || status === "partial") && invoice.canReport !== false;
  const label = paid ? "Đã đóng" : reported ? "Đã báo chuyển — chờ gia sư xác nhận" : invoice.statusLabel;
  const tone = paid ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-cho)";

  async function report() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(reportUrl, { method: "POST", credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setStatus("parent_reported"); setMsg({ text: "Đã báo cho gia sư. Gia sư sẽ xác nhận khi thấy tiền vào tài khoản.", ok: true }); }
      else setMsg({ text: d.error ?? "Chưa báo được, anh/chị thử lại sau.", ok: false });
    } catch { setMsg({ text: "Lỗi kết nối, anh/chị thử lại sau.", ok: false }); }
    finally { setBusy(false); }
  }
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 2000); } catch { setMsg({ text: "Không sao chép được, anh/chị chép tay giúp.", ok: false }); }
  }

  const open = invoice.qrUrl !== null && !paid && invoice.remaining > 0;

  return (
    <article className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }} aria-label={`Phiếu học phí ${monthLabel(invoice.yearMonth)}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{monthLabel(invoice.yearMonth)} · {invoice.tutorName}</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>Mã phiếu {invoice.code}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: tone }}>
          <span aria-hidden className="w-2 h-2 rounded-full inline-block" style={{ background: paid ? "var(--kin-tt-cham-xong)" : "var(--kin-tt-cham-cho)" }} />
          {label}
        </span>
      </div>

      <dl className="mt-3 flex gap-6 text-sm">
        <div><dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Phải đóng</dt><dd className="font-bold tabular-nums" style={{ color: "var(--kin-chu-chinh)" }}>{vnd(invoice.amountDue)}</dd></div>
        {!paid && <div><dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Còn lại</dt><dd className="font-bold tabular-nums" style={{ color: "var(--kin-th-navy)" }}>{vnd(invoice.remaining)}</dd></div>}
      </dl>

      {open && (
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={invoice.qrUrl!} alt={`Mã VietQR chuyển ${vnd(invoice.remaining)} cho ${invoice.tutorName}`} className="w-44 h-44 sm:w-52 sm:h-52 flex-shrink-0 rounded-lg" style={{ border: "1px solid var(--kin-vien-nhat)", background: "var(--kin-nen-trang)" }} />
          <div className="text-sm space-y-1 min-w-0" style={{ color: "var(--kin-chu-phu)" }}>
            {invoice.bank && <>
              <p>Ngân hàng: <b style={{ color: "var(--kin-chu-chinh)" }}>{invoice.bank.name}</b></p>
              <p>Số tài khoản: <b className="font-mono" style={{ color: "var(--kin-chu-chinh)" }}>{invoice.bank.accountNo}</b>{" "}
                <button type="button" className="underline text-xs" onClick={() => copy(invoice.bank!.accountNo, "stk")}>{copied === "stk" ? "Đã chép" : "Chép"}</button></p>
              <p>Chủ tài khoản: <b style={{ color: "var(--kin-chu-chinh)" }}>{invoice.bank.accountName}</b></p>
            </>}
            <p>Số tiền: <b style={{ color: "var(--kin-chu-chinh)" }}>{vnd(invoice.remaining)}</b></p>
            <p className="break-words">Nội dung: <b className="font-mono" style={{ color: "var(--kin-chu-chinh)" }}>{invoice.transferContent}</b>{" "}
              <button type="button" className="underline text-xs" onClick={() => copy(invoice.transferContent, "nd")}>{copied === "nd" ? "Đã chép" : "Chép"}</button></p>
            <p className="text-xs pt-1" style={{ color: "var(--kin-chu-mo)" }}>Anh/chị giữ nguyên mã {invoice.code} ở đầu nội dung để gia sư ghi nhận đúng.</p>
          </div>
        </div>
      )}

      {!invoice.bank && !paid && (
        <p className="mt-3 text-sm" style={{ color: "var(--kin-chu-phu)" }}>Gia sư chưa cập nhật tài khoản nhận tiền. Anh/chị liên hệ gia sư để được hướng dẫn chuyển khoản.</p>
      )}

      {canReport && (
        <div className="mt-4">
          <button type="button" onClick={report} disabled={busy} className="px-4 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-60"
            style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>
            {busy ? "Đang báo…" : "Tôi đã chuyển"}
          </button>
          <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Bấm sau khi chuyển khoản xong để gia sư biết và đối chiếu.</p>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className="mt-2 text-sm" style={{ color: msg.ok ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>{msg.text}</p>}
    </article>
  );
}
