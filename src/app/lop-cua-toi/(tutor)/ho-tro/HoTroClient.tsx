"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KinButton, KinCallout, KinSectionHead, KinStateCard, KinStatus, KinSkeleton } from "@/components/kin";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { CARD_STYLE, callApi } from "@/components/tutor/shared";
import { FREE_PROMISE, KIND_LABEL, LANE_LABEL, MESSAGE_MAX, PRO_PROMISE, SERIOUS_PROMISE, SUBJECT_MAX, SUPPORT_KINDS, type SupportKind, type SupportLane } from "@/lib/supportDesk";

interface Req { id: string; kind: SupportKind; kindLabel: string; subject: string; message: string; lane: SupportLane; status: string; statusLabel: string; reply: string | null; repliedAt: string | null; createdAt: string }
interface View { plan: "free" | "pro"; promise: string; privacyHint: string; maxOpen: number; requests: Req[] }
const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const LANE_TONE = { serious: "loi", priority: "cho", normal: "mo" } as const;

export default function HoTroClient() {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<SupportKind>("setup");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<View>("/api/tutor/ho-tro");
    if (!r.ok) setFailed(true); else setView(r.data);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await callApi<{ promise: string }>("/api/tutor/ho-tro", { method: "POST", body: JSON.stringify({ kind, subject, message }) });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Chưa gửi được, thử lại sau" }); return; }
    setSubject(""); setMessage("");
    setMsg({ ok: true, text: `Đã ghi trên KiN. ${r.data.promise}` });
    void load();
  }

  if (loading && !view) return <KinPage><KinPageHeader title="Liên hệ hỗ trợ" /><KinSkeleton widths={[100, 80, 60]} /></KinPage>;
  if (failed || !view) {
    return (
      <KinPage>
        <KinPageHeader title="Liên hệ hỗ trợ" />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được trang hỗ trợ" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}>
          <p>Lớp, phiếu và dữ liệu của bạn không bị ảnh hưởng.</p>
        </KinStateCard>
      </KinPage>
    );
  }

  return (
    <KinPage>
      <KinPageHeader back={{ href: "/lop-cua-toi/goi", label: "← Gói của tôi" }} title="Liên hệ hỗ trợ" sub="Gửi việc đang kẹt, KiN trả lời ngay trong trang này." />
      <div className="space-y-8 max-w-3xl">
        <KinCallout title={view.plan === "pro" ? "Bạn được hỗ trợ ưu tiên" : "Bạn đang ở gói Free"}>
          <span data-testid="loi-hua">{view.plan === "pro" ? PRO_PROMISE : FREE_PROMISE}</span>{" "}{SERIOUS_PROMISE}
        </KinCallout>

        <form onSubmit={send} className="space-y-4" data-testid="form-ho-tro">
          <fieldset className="space-y-2">
            <legend className={KIN_LABEL}>Bạn cần hỗ trợ về việc gì?</legend>
            {SUPPORT_KINDS.map(k => (
              <label key={k} className="flex items-center gap-3 min-h-[44px] text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-chinh)" }}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="w-5 h-5" style={{ accentColor: "var(--kin-nhan-nen)" }} />
                {KIND_LABEL[k]}
              </label>
            ))}
          </fieldset>
          <label className={`${KIN_LABEL} space-y-2`}>Tiêu đề
            <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={SUBJECT_MAX} required className={KIN_FIELD} data-testid="tieu-de" />
          </label>
          <label className={`${KIN_LABEL} space-y-2`}>Mô tả việc đang kẹt
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={MESSAGE_MAX} required rows={6} className={`${KIN_FIELD} py-2`} data-testid="noi-dung" />
          </label>
          <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{view.privacyHint}</p>
          {msg && <p role={msg.ok ? "status" : "alert"} className="text-sm font-medium" style={{ color: msg.ok ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }} data-testid="ket-qua">{msg.text}</p>}
          <KinButton type="submit" loading={busy} loadingLabel="Đang gửi…" data-testid="gui">Gửi yêu cầu</KinButton>
        </form>

        <section aria-labelledby="h-yc">
          <KinSectionHead id="h-yc" title="Yêu cầu của bạn" />
          {view.requests.length === 0
            ? <p className="text-sm py-2" style={{ color: "var(--kin-chu-phu)" }}>Bạn chưa gửi yêu cầu nào. Khi gửi, yêu cầu và câu trả lời sẽ hiện ở đây.</p>
            : <ul className="space-y-3">
                {view.requests.map(r => (
                  <li key={r.id} className="rounded-xl p-4 space-y-2" style={CARD_STYLE} data-testid="yeu-cau" data-lane={r.lane} data-status={r.status}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-medium min-w-0" style={{ color: "var(--kin-chu-chinh)" }}>{r.subject}</p>
                      <KinStatus tone={LANE_TONE[r.lane]}>{LANE_LABEL[r.lane]}</KinStatus>
                      <KinStatus tone={r.status === "open" ? "cho" : r.status === "answered" ? "xong" : "mo"}>{r.statusLabel}</KinStatus>
                    </div>
                    <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{r.kindLabel} · gửi {fmt(r.createdAt)}</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{r.message}</p>
                    {r.reply && (
                      <div className="rounded-lg p-3 text-sm whitespace-pre-wrap" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-chinh)" }} data-testid="tra-loi">
                        <p className="text-xs mb-1" style={{ color: "var(--kin-chu-mo)" }}>KiN trả lời{r.repliedAt ? ` ngày ${fmt(r.repliedAt)}` : ""}</p>{r.reply}
                      </div>
                    )}
                  </li>
                ))}
              </ul>}
        </section>
        <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Xem gói và quyền lợi ở <Link href="/lop-cua-toi/goi" className="underline">Gói của tôi</Link>.</p>
      </div>
    </KinPage>
  );
}
