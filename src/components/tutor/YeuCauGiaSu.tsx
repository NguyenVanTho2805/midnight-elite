// KH-04 — gia sư xem "Yêu cầu tìm gia sư" gửi tới mình và TIẾP NHẬN thành hồ sơ (chờ xếp lớp / hoạt động) hoặc từ chối.
// Đồng ý của người gửi (phụ huynh bấm ở biểu mẫu) được sao sang hồ sơ; bên nào theo tuổi còn thiếu thì gia sư xác nhận thêm (ConsentBox). Tên em do gia sư nhập.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { MODE_LABEL, type TeachingMode } from "@/lib/tutorArea";
import { AGE_GROUP_LABEL, requiredConsent, type AgeGroup } from "@/lib/consentPolicy";
import { TUTOR_STATUS_TEXT, type RequestStatus } from "@/lib/tutorRequest";
import ConsentBox, { EMPTY_CONSENT, consentBody, type ConsentValue } from "@/components/tutor/ConsentBox";
import { RadioCards, SelectField, TextField, fmtVnDate, jfetch } from "@/components/tutor/studentUi";

interface Req { id: string; status: RequestStatus; level: string; subject: string; mode: string | null; slots: string | null; note: string | null; contactName: string | null; contactPhone: string; role: "guardian" | "self"; createdAt: string; profileId: string | null }
const TONE = { new: "cho", accepted: "xong", declined: "mo", closed: "mo" } as const;

function Accept({ r, courses, onDone }: { r: Req; courses: { id: string; name: string }[]; onDone: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<AgeGroup | "">(r.role === "self" ? "16plus" : "");
  const [status, setStatus] = useState<"waitlist" | "active">("waitlist");
  const [courseId, setCourseId] = useState("");
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const need = useMemo(() => group ? requiredConsent({ declared: group, birthKey: null, now: new Date() }).parties : [], [group]);
  const remaining = need.filter(p => p !== r.role);
  const ticked = remaining.every(p => consent[p]);

  async function go() {
    setBusy(true); setErr("");
    const res = await jfetch(`/api/tutor/yeu-cau/${r.id}/tiep-nhan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ageGroup: group, status, courseId: courseId || null, consent: consentBody(consent) }) });
    setBusy(false);
    if (res.status === 201) onDone("Đã tiếp nhận. Hồ sơ của em nằm ở trang Học sinh."); else setErr(res.json?.error ?? "Chưa tiếp nhận được, thử lại nhé.");
  }
  return (
    <div data-accept className="mt-3 space-y-4 border-t border-[var(--kin-vien-nhat)] pt-4">
      <TextField label="Tên em" required value={name} onChange={setName} maxLength={60} hint="Biểu mẫu của khách không thu tên của em. Nhập tên em sau khi đã trao đổi với người gửi." />
      {r.role === "guardian"
        ? <RadioCards name={`age-${r.id}`} legend="Nhóm tuổi của em" value={group} onChange={setGroup} options={(["u7", "7to15", "16plus"] as const).map(g => ({ key: g, title: AGE_GROUP_LABEL[g] }))} />
        : <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Người gửi là người học đã đủ 16 tuổi.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Trạng thái" value={status} onChange={v => setStatus(v as "waitlist" | "active")}><option value="waitlist">Đang chờ xếp lớp</option><option value="active">Hoạt động (đã vào lớp)</option></SelectField>
        <SelectField label="Lớp" value={courseId} onChange={setCourseId}><option value="">Chưa xếp lớp</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField>
      </div>
      {group && (remaining.length > 0
        ? <ConsentBox parties={remaining} value={consent} onChange={setConsent} forcedScopes={["basic"]} optionalScopes={[]} id={`acc-${r.id}`} />
        : <KinCallout title="Đồng ý đã có">Người gửi đã tích đồng ý ở biểu mẫu (KiN không xác minh người bấm). Hồ sơ chỉ nhận phạm vi thông tin cơ bản.</KinCallout>)}
      {err && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <button type="button" data-accept-go onClick={go} disabled={busy || !name.trim() || !group || !ticked} className={kinButtonClass("primary")}>{busy ? "Đang lưu…" : "Tiếp nhận và tạo hồ sơ"}</button>
    </div>
  );
}

export default function YeuCauGiaSu() {
  const { ask, dialog } = useKinConfirm();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const fetchAll = useCallback(async () => ({ a: await jfetch("/api/tutor/yeu-cau"), b: await jfetch("/api/tutor/ho-so") }), []);
  const apply = useCallback(({ a, b }: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!a.ok) { setError(true); return; }
    setRows(a.json.requests); setCourses(b.ok ? (b.json.courses ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : []); setError(false);
  }, []);
  const reload = useCallback(() => { fetchAll().then(apply); }, [fetchAll, apply]);
  useEffect(() => { let alive = true; fetchAll().then(x => { if (alive) apply(x); }); return () => { alive = false; }; }, [fetchAll, apply]);

  async function decline(r: Req) {
    const ok = await ask({ title: "Từ chối yêu cầu này?", message: "Số liên hệ của người gửi bị xoá khỏi yêu cầu. Người gửi thấy trạng thái “Gia sư chưa nhận được lần này”.", confirmLabel: "Từ chối" });
    if (!ok) return;
    const res = await jfetch(`/api/tutor/yeu-cau/${r.id}/tu-choi`, { method: "POST" });
    if (res.ok) { setMsg("Đã từ chối yêu cầu."); reload(); } else setMsg(res.json?.error ?? "Chưa từ chối được.");
  }

  if (rows === null && !error) return <KinPageSkeleton label="Đang tải yêu cầu" side={false} />;
  const newOnes = (rows ?? []).filter(r => r.status === "new");
  return (
    <KinPage>
      {dialog}
      <KinPageHeader title="Yêu cầu tìm gia sư" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} sub={rows ? `${newOnes.length} yêu cầu mới. Chỉ gồm yêu cầu gửi tới bạn.` : undefined} />
      <div className="max-w-[760px] space-y-5">
        <KinCallout title="Số liên hệ chỉ bạn thấy">Khách gửi cấp học, môn, khung giờ và số Zalo; không có tên hay ngày sinh của em. Tiếp nhận thì hồ sơ em mới được tạo; từ chối hoặc quá 30 ngày chưa phản hồi thì số liên hệ bị xoá khỏi yêu cầu. KiN không thu hoa hồng và không thu hộ học phí.</KinCallout>
        {error && <ErrorStrip message="Không tải được danh sách yêu cầu." onRetry={() => { setError(false); reload(); }} />}
        {msg && <p role="status" className="text-[var(--kin-tt-chu-xong)]">{msg}</p>}
        {rows && rows.length === 0 && (
          <KinEmptyState title="Chưa có yêu cầu nào" action={<Link href="/lop-cua-toi/ho-so" className={kinButtonClass("secondary")}>Xem hồ sơ công khai của bạn</Link>}>
            Khi phụ huynh gửi yêu cầu từ hồ sơ công khai của bạn, yêu cầu sẽ hiện ở đây. Hồ sơ đang ẩn thì khách không gửi được.
          </KinEmptyState>
        )}
        <ul aria-label="Yêu cầu tìm gia sư" className="space-y-4">
          {(rows ?? []).map(r => (
            <li key={r.id} data-yeu-cau className="border border-[var(--kin-vien-nhat)] rounded-[var(--kin-bo-md)] p-[var(--kin-kc-7)] text-[length:var(--kin-co-goc)] leading-5">
              <p className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-[var(--kin-chu-chinh)]">{r.level} · {r.subject}</span><KinStatus tone={TONE[r.status]}>{TUTOR_STATUS_TEXT[r.status]}</KinStatus></p>
              <p className="text-[var(--kin-chu-mo)]">Gửi ngày {fmtVnDate(r.createdAt)}{r.mode ? ` · ${MODE_LABEL[r.mode as TeachingMode] ?? r.mode}` : ""}{r.slots ? ` · ${r.slots}` : ""}</p>
              {r.status === "new" && (
                <>
                  {r.note && <p className="mt-1 break-words">Ghi chú: {r.note}</p>}
                  <p className="mt-1">{r.role === "self" ? "Người học" : "Phụ huynh"}{r.contactName ? ` ${r.contactName}` : ""}: <a href={`tel:${r.contactPhone}`} className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">{r.contactPhone}</a>{" · "}
                    <a href={`https://zalo.me/${r.contactPhone}`} target="_blank" rel="noopener noreferrer" className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">Mở Zalo</a></p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button type="button" data-open-accept onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className={kinButtonClass("primary")}>Tiếp nhận</button>
                    <button type="button" data-decline onClick={() => decline(r)} className={kinButtonClass("secondary")}>Từ chối</button>
                  </div>
                  {open === r.id && <Accept r={r} courses={courses} onDone={m => { setMsg(m); setOpen(null); reload(); }} />}
                </>
              )}
              {r.status === "accepted" && r.profileId && <p className="mt-1"><Link href={`/lop-cua-toi/hoc-sinh/${r.profileId}`} className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">Mở hồ sơ của em</Link></p>}
            </li>
          ))}
        </ul>
      </div>
    </KinPage>
  );
}
