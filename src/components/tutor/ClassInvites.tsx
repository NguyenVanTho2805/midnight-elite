// FE-151/160 — mã mời của 1 lớp: ClassInviteForm (tạo) + ClassInviteList (xem, sao
// chép link, thu hồi). API: /api/courses/[id]/invites (BE-064/065) và DELETE
// /api/invites/[id] (BE-066). Link chia sẻ mở thẳng trang nhập mã với mã điền sẵn.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";

export interface Invite {
  id: string; code: string; maxUses: number | null; usedCount: number;
  expiresAt: string | null; revoked: boolean; createdAt: string;
}

function inviteState(i: Invite, now: number): { label: string; tone: "ok" | "wait" | "bad" | "neutral"; usable: boolean } {
  if (i.revoked) return { label: "Đã thu hồi", tone: "neutral", usable: false };
  if (i.expiresAt && new Date(i.expiresAt).getTime() <= now) return { label: "Đã hết hạn", tone: "bad", usable: false };
  if (i.maxUses != null && i.usedCount >= i.maxUses) return { label: "Đã hết lượt", tone: "bad", usable: false };
  return { label: "Đang dùng được", tone: "ok", usable: true };
}

export function ClassInviteForm({ courseId, onCreated }: { courseId: string; onCreated: (inv: Invite) => void }) {
  const notify = useNotify();
  const [maxUses, setMaxUses] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const uses = maxUses.trim() === "" ? null : Number(maxUses);
    const d = days.trim() === "" ? null : Number(days);
    if (uses !== null && (!Number.isInteger(uses) || uses <= 0)) { notify.err("Số lượt dùng phải là số nguyên dương"); return; }
    if (d !== null && (!Number.isInteger(d) || d <= 0 || d > 365)) { notify.err("Số ngày hiệu lực từ 1 đến 365"); return; }
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (uses !== null) body.maxUses = uses;
    if (d !== null) body.expiresAt = new Date(Date.now() + d * 86_400_000).toISOString();
    const r = await callApi<Invite & { error?: string }>(`/api/courses/${courseId}/invites`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không tạo được mã mời"); return; }
    notify.ok(`Đã tạo mã ${r.data.code}.`);
    setMaxUses(""); setDays("");
    onCreated(r.data);
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void create(); }} className="rounded-xl p-4" style={CARD_STYLE} aria-label="Tạo mã mời mới">
      <p className="font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Tạo mã mời mới</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Số lượt dùng tối đa <span style={{ color: "var(--kin-chu-phu)" }}>(bỏ trống = không giới hạn)</span>
          <input inputMode="numeric" value={maxUses} onChange={e => setMaxUses(e.target.value.replace(/\D/g, ""))} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE} />
        </label>
        <label className="text-sm">Hiệu lực (số ngày) <span style={{ color: "var(--kin-chu-phu)" }}>(bỏ trống = không hết hạn)</span>
          <input inputMode="numeric" value={days} onChange={e => setDays(e.target.value.replace(/\D/g, ""))} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE} />
        </label>
      </div>
      <div className="mt-3"><KinButton type="submit" loading={busy}>Tạo mã mời</KinButton></div>
    </form>
  );
}

export function ClassInviteList({ items, onChanged }: { items: Invite[]; onChanged: () => void }) {
  const notify = useNotify();
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  async function copyLink(i: Invite) {
    const url = `${window.location.origin}/student/nhap-ma-lop?code=${i.code}`;
    const ok = await copyText(url);
    if (ok) notify.ok("Đã sao chép link mời."); else notify.err("Không sao chép được.");
  }
  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    const r = await callApi<{ error?: string }>(`/api/invites/${revoking.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không thu hồi được"); return; }
    notify.ok(`Đã thu hồi mã ${revoking.code}.`);
    setRevoking(null);
    onChanged();
  }

  if (items.length === 0) return <p className="text-sm py-4" style={{ color: "var(--kin-chu-phu)" }}>Chưa có mã mời nào. Tạo mã rồi gửi cho học viên.</p>;
  return (
    <>
      <ul className="space-y-2">
        {items.map(i => {
          const st = inviteState(i, now);
          return (
            <li key={i.id} className="rounded-xl p-4" style={CARD_STYLE}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-lg font-mono font-bold tracking-wider" style={{ color: "var(--kin-chu-chinh)" }}>{i.code}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>
                Đã dùng {i.usedCount}{i.maxUses != null ? `/${i.maxUses}` : ""} lượt
                {i.expiresAt ? ` · hết hạn ${new Date(i.expiresAt).toLocaleDateString("vi-VN")}` : " · không hết hạn"}
                {` · tạo ${new Date(i.createdAt).toLocaleDateString("vi-VN")}`}
              </p>
              {st.usable && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <KinButton variant="secondary" onClick={() => copyLink(i)}>Sao chép link</KinButton>
                  <KinButton variant="ghost" onClick={() => copyText(i.code).then(ok => notify[ok ? "ok" : "err"](ok ? "Đã sao chép mã." : "Không sao chép được."))}>Sao chép mã</KinButton>
                  <KinButton variant="ghost" onClick={() => setRevoking(i)}>Thu hồi</KinButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {revoking && (
        <Modal title={`Thu hồi mã ${revoking.code}?`} onClose={() => setRevoking(null)}>
          <p className="text-sm mb-4" style={{ color: "var(--kin-chu-phu)" }}>Mã này sẽ không dùng được nữa. Học viên đã vào lớp bằng mã vẫn ở trong lớp.</p>
          <div className="flex justify-end gap-2">
            <KinButton variant="ghost" onClick={() => setRevoking(null)}>Đóng</KinButton>
            <KinButton loading={busy} onClick={revoke} style={{ background: "var(--kin-tt-chu-loi)", borderColor: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" }}>Thu hồi</KinButton>
          </div>
        </Modal>
      )}
    </>
  );
}

// Khối đầy đủ cho Hộp việc của lớp.
export default function ClassInvitesPanel({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<{ items: Invite[] }>(`/api/courses/${courseId}/invites`);
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setItems(r.data.items);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <ClassInviteForm courseId={courseId} onCreated={() => load()} />
      {loading ? <div className="h-20 rounded-xl animate-pulse" style={CARD_STYLE} aria-busy="true" />
        : failed ? <div role="alert" className="rounded-xl p-5 text-center text-sm" style={CARD_STYLE}>Không tải được danh sách mã mời. <button className="underline font-semibold" onClick={load}>Thử lại</button></div>
        : <ClassInviteList items={items} onChanged={load} />}
    </div>
  );
}
