// PH-212 — nút "Báo cáo hồ sơ" trên hồ sơ công khai của gia sư. Không cần tài khoản.
"use client";
import { useState } from "react";
import { Modal, callApi } from "@/components/tutor/shared";
import { REPORT_DETAIL_MAX, REPORT_REASONS, type ReportReason } from "@/lib/funnel";

export default function ReportProfileButton({ tutorId }: { tutorId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!reason) { setErr("Hãy chọn lý do báo cáo."); return; }
    if (reason === "khac" && !detail.trim()) { setErr("Hãy mô tả ngắn lý do."); return; }
    setBusy(true); setErr("");
    const n = new URLSearchParams(window.location.search).get("n") ?? undefined;
    const r = await callApi(`/api/tutors/${tutorId}/report`, { method: "POST", body: JSON.stringify({ reason, detail: detail.trim() || undefined, n }) });
    setBusy(false);
    if (r.ok) setDone(true);
    else setErr(r.status === 429 ? "Bạn đã gửi báo cáo gần đây, vui lòng thử lại sau." : r.data.error ?? "Chưa gửi được báo cáo, thử lại sau.");
  }
  function close() { setOpen(false); setDone(false); setErr(""); setReason(""); setDetail(""); }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="underline text-sm min-h-[44px]" style={{ color: "var(--kin-chu-phu)" }}>Báo cáo hồ sơ này</button>
      {open && (
        <Modal title="Báo cáo hồ sơ gia sư" onClose={close}>
          {done ? (
            <div role="status">
              <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>Đã nhận báo cáo của anh/chị. KiN sẽ xem xét và khoá hồ sơ nếu có căn cứ.</p>
              <div className="mt-4 text-right"><button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]" style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}>Đóng</button></div>
            </div>
          ) : (
            <>
              <fieldset className="text-sm">
                <legend className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Lý do</legend>
                {REPORT_REASONS.map(r => (
                  <label key={r.key} className="flex items-center gap-2 py-1 min-h-[44px]">
                    <input type="radio" name="report-reason" checked={reason === r.key} onChange={() => setReason(r.key)} /> {r.label}
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm mt-2" htmlFor="report-detail">Mô tả thêm (không bắt buộc, trừ “Lý do khác”)</label>
              <textarea id="report-detail" rows={3} maxLength={REPORT_DETAIL_MAX} value={detail} onChange={e => setDetail(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Đừng ghi số điện thoại hay thông tin cá nhân của con. Báo cáo này không cần tài khoản.</p>
              {err && <p role="alert" className="text-sm mt-2" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p>}
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm min-h-[44px]" style={{ color: "var(--kin-chu-phu)" }}>Huỷ</button>
                <button type="button" onClick={() => void submit()} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-60" style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}>{busy ? "Đang gửi…" : "Gửi báo cáo"}</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
