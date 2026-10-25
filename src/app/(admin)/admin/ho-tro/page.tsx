// KiN Pro F6 — hàng đợi hỗ trợ gia sư (quản trị, quyền MANAGE_TUTORS). Khẩn → Ưu tiên (Pro) → Thường, cũ nhất trước. Trả lời hiện cho gia sư ở trang Liên hệ hỗ trợ.
// Lời hứa với Pro là "trong giờ hành chính", không phải 24/7.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinSkeleton, KinStateCard, KinStatus, useKinConfirm } from "@/components/kin";
import { KinPage, KinPageHeader, KIN_FIELD } from "@/components/kin/PageLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { CARD_STYLE, callApi } from "@/components/tutor/shared";
import { LANE_LABEL, REPLY_MAX, type SupportLane } from "@/lib/supportDesk";

interface Item { id: string; userName: string; userEmail: string; kindLabel: string; subject: string; message: string; lane: SupportLane; status: string; statusLabel: string; reply: string | null; createdAt: string }
const fmt = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const LANE_TONE = { serious: "loi", priority: "cho", normal: "mo" } as const;

export default function HoTroAdminPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}><Content /></PermissionGuard>;
}

function Content() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    const r = await callApi<{ requests: Item[]; openCount: number }>("/api/admin/ho-tro");
    if (!r.ok) setFailed(true); else { setItems(r.data.requests); setOpenCount(r.data.openCount); }
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function act(it: Item, action: "reply" | "close") {
    if (action === "close" && !(await ask({ title: "Đóng yêu cầu này?", message: `${it.userName} · ${it.subject}`, confirmLabel: "Đóng yêu cầu" }))) return;
    setBusy(it.id); setMsg(null);
    const r = await callApi(`/api/admin/ho-tro/${it.id}`, { method: "PATCH", body: JSON.stringify(action === "reply" ? { action, reply: drafts[it.id] ?? "" } : { action }) });
    setBusy(null);
    setMsg(r.ok ? (action === "reply" ? "Đã gửi trả lời." : "Đã đóng yêu cầu.") : (r.data.error ?? "Không thực hiện được"));
    if (r.ok) setDrafts(d => ({ ...d, [it.id]: "" }));
    void load();
  }

  return (
    <KinPage>
      <KinPageHeader title="Hỗ trợ gia sư" sub={`${openCount} yêu cầu đang chờ · khẩn trước, rồi Ưu tiên (gói Pro), rồi thường; cũ nhất trước`} />
      <div className="space-y-4 max-w-4xl">
        {msg && <p role="status" className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{msg}</p>}
        {loading && !items ? <KinSkeleton widths={[100, 80, 60]} />
          : failed || !items ? (
            <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được hàng đợi" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
              actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}><p>Thử lại sau ít giây.</p></KinStateCard>
          ) : items.length === 0 ? <p className="text-sm py-4" style={{ color: "var(--kin-chu-phu)" }}>Chưa có yêu cầu nào. Gia sư gửi ở trang Liên hệ hỗ trợ sẽ hiện ở đây.</p>
          : <ul className="space-y-3">
              {items.map(it => (
                <li key={it.id} className="rounded-xl p-4 space-y-2" style={CARD_STYLE} data-testid="hang-doi" data-lane={it.lane} data-status={it.status}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <KinStatus tone={LANE_TONE[it.lane]}>{LANE_LABEL[it.lane]}</KinStatus>
                    <KinStatus tone={it.status === "open" ? "cho" : it.status === "answered" ? "xong" : "mo"}>{it.statusLabel}</KinStatus>
                    <p className="font-medium min-w-0" style={{ color: "var(--kin-chu-chinh)" }}>{it.subject}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{it.userName} · {it.userEmail} · {it.kindLabel} · {fmt(it.createdAt)}</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>{it.message}</p>
                  {it.reply && <p className="text-sm whitespace-pre-wrap rounded-lg p-3" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-chinh)" }}>{it.reply}</p>}
                  {it.status !== "closed" && (
                    <div className="space-y-2">
                      <textarea aria-label={`Trả lời ${it.userName}`} rows={3} maxLength={REPLY_MAX} value={drafts[it.id] ?? ""} onChange={e => setDrafts(d => ({ ...d, [it.id]: e.target.value }))} className={`${KIN_FIELD} py-2`} />
                      <div className="flex gap-3 flex-wrap">
                        <KinButton loading={busy === it.id} loadingLabel="Đang gửi…" onClick={() => void act(it, "reply")}>Gửi trả lời</KinButton>
                        <KinButton variant="secondary" disabled={busy === it.id} onClick={() => void act(it, "close")}>Đóng yêu cầu</KinButton>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>}
      </div>
      {dialog}
    </KinPage>
  );
}
