// FE-151/160 — mã mời của 1 lớp: ClassInviteForm (tạo) + ClassInviteList (xem, sao
// chép link, thu hồi). API: /api/courses/[id]/invites (BE-064/065) và DELETE
// /api/invites/[id] (BE-066). Link chia sẻ mở thẳng trang nhập mã với mã điền sẵn.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton, KinConfirm } from "@/components/kin";
import { Badge, CARD_STYLE, FIELD_STYLE, callApi, useNotify } from "@/components/tutor/shared";
import { KinCopyButton } from "@/components/kin/CopyButton";
import BulkInvite from "@/components/tutor/BulkInvite";
import { KinStatus } from "@/components/kin/Status";
import type { JoinPolicy } from "@/lib/joinRequest";

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
      <p className="font-medium mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Tạo mã mời mới</p>
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
                <span className="text-lg font-mono font-medium tracking-wider" style={{ color: "var(--kin-chu-chinh)" }}>{i.code}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>
                Đã dùng {i.usedCount}{i.maxUses != null ? `/${i.maxUses}` : ""} lượt
                {i.expiresAt ? ` · hết hạn ${new Date(i.expiresAt).toLocaleDateString("vi-VN")}` : " · không hết hạn"}
                {` · tạo ${new Date(i.createdAt).toLocaleDateString("vi-VN")}`}
              </p>
              {st.usable && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <KinCopyButton appearance="button" buttonVariant="secondary" label="Sao chép link" text={() => `${window.location.origin}/student/nhap-ma-lop?code=${i.code}`} onResult={ok => notify[ok ? "ok" : "err"](ok ? "Đã sao chép link mời." : "Không sao chép được.")}>Sao chép link</KinCopyButton>
                  <KinCopyButton appearance="button" buttonVariant="ghost" label="Sao chép mã" text={i.code} onResult={ok => notify[ok ? "ok" : "err"](ok ? "Đã sao chép mã." : "Không sao chép được.")}>Sao chép mã</KinCopyButton>
                  <KinButton variant="danger" onClick={() => setRevoking(i)}>Thu hồi</KinButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <KinConfirm
        open={!!revoking}
        tone="nguy-hiem"
        title={`Thu hồi mã ${revoking?.code ?? ""}?`}
        message="Mã này sẽ không dùng được nữa. Học viên đã vào lớp bằng mã vẫn ở trong lớp."
        cancelLabel="Đóng"
        confirmLabel="Thu hồi"
        loading={busy}
        onCancel={() => setRevoking(null)}
        onConfirm={revoke}
      />
    </>
  );
}

const POLICY_OPTIONS: { value: JoinPolicy; title: string; hint: string }[] = [
  { value: "approve", title: "Cô duyệt", hint: "Học sinh bấm Vào lớp hoặc nhập mã thì thành yêu cầu, cô duyệt ở tab Học sinh." },
  { value: "invite_only", title: "Chỉ mã mời", hint: "Chỉ ai có mã cô gửi mới vào được, vào ngay không cần duyệt." },
  { value: "open", title: "Vào ngay", hint: "Học sinh bấm Vào lớp ở trang lớp là vào ngay. Chỉ dành cho lớp miễn phí." },
];

/** BU-01: ô "Cách vào lớp" (lưu bằng PATCH /api/courses/<id>) + link trang lớp để gửi cho học sinh. */
export function JoinPolicyBox({ courseId, policy, isFree, canOpen, pending, onChanged }: { courseId: string; policy: JoinPolicy; isFree: boolean; canOpen: boolean; pending: number; onChanged?: (next: JoinPolicy) => void }) {
  const notify = useNotify();
  const [value, setValue] = useState<JoinPolicy>(policy);
  const [asking, setAsking] = useState<JoinPolicy | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: JoinPolicy) {
    setBusy(true);
    const r = await callApi<{ error?: string }>(`/api/courses/${courseId}`, { method: "PATCH", body: JSON.stringify({ joinPolicy: next }) });
    setBusy(false); setAsking(null);
    if (!r.ok) { notify.err(r.data.error ?? "Chưa đổi được cách vào lớp, thử lại sau."); return; }
    setValue(next);
    notify.ok("Đã đổi cách vào lớp.");
    onChanged?.(next);
  }
  function choose(next: JoinPolicy) {
    if (next === value || busy) return;
    if (value === "approve" && pending > 0) { setAsking(next); return; } // còn yêu cầu chờ: nói rõ rồi mới đổi
    void save(next);
  }

  return (
    <section className="rounded-xl p-4" style={CARD_STYLE} aria-labelledby="cvl-title" data-join-policy-box>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p id="cvl-title" className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Cách vào lớp</p>
        {isFree && <KinStatus tone="xong">Miễn phí</KinStatus>}
      </div>
      <fieldset className="mt-3 space-y-2" disabled={busy}>
        <legend className="sr-only">Cách học sinh vào lớp</legend>
        {POLICY_OPTIONS.map(o => {
          const locked = o.value === "open" && !canOpen;
          return (
            <label key={o.value} className={`flex items-start gap-3 min-h-11 py-1 text-sm ${locked ? "opacity-60" : ""}`}>
              <input type="radio" name="cvl-policy" className="mt-1 size-5" checked={value === o.value} disabled={locked} onChange={() => choose(o.value)} />
              <span><span className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{o.title}</span>
                <span className="block" style={{ color: "var(--kin-chu-phu)" }}>{locked ? "Chỉ bật được khi lớp miễn phí (chưa có đơn giá học phí)." : o.hint}</span></span>
            </label>
          );
        })}
      </fieldset>
      <KinConfirm
        open={asking !== null}
        title="Đổi cách vào lớp?"
        message={`Còn ${pending} yêu cầu đang chờ. Các yêu cầu đó vẫn giữ nguyên để cô duyệt sau ở tab Học sinh.`}
        cancelLabel="Giữ nguyên"
        confirmLabel="Vẫn đổi"
        loading={busy}
        onCancel={() => setAsking(null)}
        onConfirm={() => { if (asking) void save(asking); }}
      />
    </section>
  );
}


/** Câu giải thích theo cách vào lớp — một nguồn cho khối "Cách học sinh vào lớp" (tab Mã mời, đầu trang lớp). */
export function joinHowText(policy: JoinPolicy, hasCode: boolean): string {
  if (policy === "open") return "Học sinh mở link trang lớp, bấm Vào lớp là vào ngay, không cần mã và không cần cô duyệt.";
  if (policy === "approve") return hasCode
    ? "Học sinh nhập mã lớp (ở Lớp của tôi, mục Nhập mã lớp) hoặc mở link trang lớp rồi bấm Xin vào lớp. Cô duyệt từng em ở tab Học sinh."
    : "Học sinh mở link trang lớp rồi bấm Xin vào lớp, hoặc nhập mã lớp. Cô duyệt từng em ở tab Học sinh.";
  return "Chỉ ai có mã lớp mới vào được. Cô gửi mã này cho học sinh; em nhập ở Lớp của tôi, mục Nhập mã lớp là vào lớp ngay.";
}

/**
 * Khối "Cách học sinh vào lớp": mã lớp có sẵn (đọc từ ClassInvite, tự tạo một lần khi tạo lớp), link trang lớp, nút sao chép và câu giải thích.
 * Lớp cũ chưa có mã: nút "Tạo mã lớp" gọi POST /api/courses/<id>/invites {ensure:true} (idempotent), xong làm mới trang.
 */
export function ClassJoinHowTo({ courseId, policy, code, onChanged }: { courseId: string; policy: JoinPolicy; code: string | null; onChanged: () => void }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const needsCode = policy !== "open";
  async function make() {
    setBusy(true);
    const r = await callApi<{ error?: string }>(`/api/courses/${courseId}/invites`, { method: "POST", body: JSON.stringify({ ensure: true }) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Chưa tạo được mã lớp, thử lại sau."); return; }
    onChanged();
  }
  const done = (what: string) => (ok: boolean) => notify[ok ? "ok" : "err"](ok ? `Đã sao chép ${what}.` : "Không sao chép được.");
  return (
    <section className="rounded-xl p-4" style={CARD_STYLE} aria-labelledby="chv-title" data-join-howto data-policy={policy}>
      <p id="chv-title" className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Cách học sinh vào lớp</p>
      <p className="mt-1 text-sm" style={{ color: "var(--kin-chu-phu)" }} data-join-howto-text>{joinHowText(policy, !!code)}</p>
      {needsCode && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Mã lớp</span>
          {code ? (<>
            <span className="text-xl font-mono font-medium tracking-wider tabular-nums" style={{ color: "var(--kin-chu-chinh)" }} data-class-code>{code}</span>
            <KinCopyButton appearance="button" buttonVariant="secondary" label="Sao chép mã lớp" text={code} onResult={done("mã lớp")}>Sao chép mã</KinCopyButton>
            <KinCopyButton appearance="button" buttonVariant="ghost" label="Sao chép link vào lớp bằng mã" text={() => `${window.location.origin}/student/nhap-ma-lop?code=${code}`} onResult={done("link nhập mã")}>Sao chép link nhập mã</KinCopyButton>
          </>) : (
            <KinButton variant="secondary" loading={busy} loadingLabel="Đang tạo…" onClick={() => void make()}>Tạo mã lớp</KinButton>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Link trang lớp</span>
        <KinCopyButton appearance="button" buttonVariant={needsCode ? "ghost" : "secondary"} label="Sao chép link trang lớp" text={() => `${window.location.origin}/khoa-hoc/${courseId}`} onResult={done("link trang lớp")}>Sao chép link trang lớp</KinCopyButton>
      </div>
    </section>
  );
}

// Khối đầy đủ cho Hộp việc của lớp.
export default function ClassInvitesPanel({ courseId, courseName, tutorName, join, classCode, onChanged }: {
  courseId: string; courseName?: string; tutorName?: string | null;
  /** BU-01: có thì hiện khối "Cách học sinh vào lớp" (mã lớp có sẵn) rồi ô "Cách vào lớp" ở đầu. */
  join?: { policy: JoinPolicy; isFree: boolean; canOpen: boolean; pending: number };
  classCode?: string | null;
  /** Mã vừa tạo/thu hồi hoặc cách vào lớp vừa đổi: nơi gọi làm mới trang để khối trên đầu đọc lại. */
  onChanged?: () => void;
}) {
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
      {join && <ClassJoinHowTo courseId={courseId} policy={join.policy} code={classCode ?? null} onChanged={() => onChanged?.()} />}
      {join && <JoinPolicyBox courseId={courseId} policy={join.policy} isFree={join.isFree} canOpen={join.canOpen} pending={join.pending} onChanged={() => onChanged?.()} />}
      <ClassInviteForm courseId={courseId} onCreated={() => { void load(); onChanged?.(); }} />
      {courseName ? <BulkInvite courseId={courseId} courseName={courseName} tutorName={tutorName} onCreated={() => { void load(); onChanged?.(); }} /> : null}
      {loading ? <div className="h-20 rounded-xl animate-pulse" style={CARD_STYLE} aria-busy="true" />
        : failed ? <div role="alert" className="rounded-xl p-5 text-center text-sm" style={CARD_STYLE}>Không tải được danh sách mã mời. <button className="underline font-medium" onClick={load}>Thử lại</button></div>
        : <ClassInviteList items={items} onChanged={() => { void load(); onChanged?.(); }} />}
    </div>
  );
}
