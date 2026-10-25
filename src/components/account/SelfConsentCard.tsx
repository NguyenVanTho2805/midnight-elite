// Học sinh tự đồng ý / thu hồi để gia sư ghi thông tin lớp học của em (User.selfConsentAt, D04 — đồng ý kép từ 7 tuổi, tự đồng ý từ 16).
// Chữ trung thực: đây là lời đồng ý của em ghi trên KiN, KiN không xác minh tuổi hay người bấm. CHƯA có ý kiến luật sư.
"use client";
import { useCallback, useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { useKinConfirm } from "@/components/kin/useConfirm";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default function SelfConsentCard({ onNotify }: { onNotify?: (msg: string, type: "success" | "error") => void }) {
  const [at, setAt] = useState<string | null | undefined>(undefined);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(() => {
    fetch("/api/users/me/self-consent", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setAt(d.selfConsentAt ?? null); setError(false); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function grant() {
    setBusy(true);
    const r = await fetch("/api/users/me/self-consent", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree: true }) });
    setBusy(false);
    if (r.ok) { const d = await r.json(); setAt(d.selfConsentAt); setAgree(false); onNotify?.("Đã ghi đồng ý của em trên KiN", "success"); } else onNotify?.("Chưa ghi được, thử lại nhé", "error");
  }
  async function revoke() {
    const ok = await ask({ title: "Thu hồi đồng ý?", message: "Gia sư sẽ không xem được thông tin mở rộng về em cho tới khi em đồng ý lại.", confirmLabel: "Thu hồi", tone: "nguy-hiem" });
    if (!ok) return;
    setBusy(true);
    const r = await fetch("/api/users/me/self-consent", { method: "DELETE", credentials: "same-origin" });
    setBusy(false);
    if (r.ok) { setAt(null); onNotify?.("Đã thu hồi đồng ý", "success"); } else onNotify?.("Chưa thu hồi được, thử lại nhé", "error");
  }

  return (
    <section data-self-consent className="rounded-2xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      {dialog}
      <h2 className="text-base font-semibold text-[var(--kin-chu-chinh)]">Đồng ý để gia sư ghi thông tin lớp học của em</h2>
      <p className="mt-1 text-sm text-[var(--kin-chu-mo)]">
        Gia sư của lớp em có thể ghi tên, liên hệ, ngày sinh, địa chỉ và điểm từng buổi của em vào sổ lớp trên KiN, chỉ để dạy học và liên lạc về lớp.
        Từ 7 tuổi, cần cả em và phụ huynh đồng ý; từ 16 tuổi, em tự đồng ý. KiN ghi lại việc em bấm và lúc bấm; KiN không kiểm tra tuổi hay người bấm.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--kin-tt-chu-loi)]">Không tải được trạng thái. <button type="button" onClick={load} className="underline min-h-11">Thử lại</button></p>
      ) : at === undefined ? (
        <p className="mt-3 text-sm text-[var(--kin-chu-mo)]">Đang tải…</p>
      ) : at ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-[var(--kin-tt-chu-xong)]">Em đã đồng ý ngày {fmt(at)}</span>
          <button type="button" disabled={busy} onClick={revoke} className={kinButtonClass("secondary")}>Thu hồi đồng ý</button>
        </div>
      ) : (
        <div className="mt-3">
          <label className="flex items-start gap-3 min-h-11 text-sm text-[var(--kin-chu-chinh)]">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1 size-5" />
            <span>Em đồng ý để gia sư lớp em ghi các thông tin nói trên vào sổ lớp.</span>
          </label>
          <button type="button" disabled={!agree || busy} onClick={grant} className={`${kinButtonClass("primary")} mt-2`}>{busy ? "Đang ghi…" : "Ghi đồng ý của em"}</button>
          <p className="mt-2 text-xs text-[var(--kin-chu-mo)]">Chưa tích thì gia sư không ghi được thông tin mở rộng về em.</p>
        </div>
      )}
    </section>
  );
}
