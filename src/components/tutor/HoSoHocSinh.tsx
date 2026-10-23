// Hồ sơ một học sinh của gia sư (HS-03 sửa kèm nhật ký, HS-04 trường mở rộng, HS-10 trạng thái, HS-11 loại Con/Người lớn + người thanh toán, LO-18 trường tuỳ chỉnh).
// Thiếu đồng ý ⇒ hồ sơ bị che (chỉ còn tên) và không sửa được cho tới khi đồng ý lại. Sổ đồng ý: ai, khi nào, phạm vi, phiên bản chữ; thu hồi được.
// Nhật ký sửa chỉ ghi TÊN trường, không ghi giá trị.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { AGE_GROUP_LABEL, PARTY_LABEL, REVOKE_NOTE, SCOPE_LABEL, payerLabel, type ConsentParty, type ConsentScope } from "@/lib/consentPolicy";
import { FIELD_LABEL, STATUS_LABEL, type ProfileStatus } from "@/lib/studentProfile";
import ConsentBox, { EMPTY_CONSENT, consentBody, type ConsentValue } from "@/components/tutor/ConsentBox";
import { SelectField, TextArea, TextField, fmtVnDate, fmtVnDateTime, jfetch, keyToVn } from "@/components/tutor/studentUi";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Detail {
  profile: any; ledger: { id: string; party: ConsentParty; scopes: ConsentScope[]; method: string; textVersion: string; grantedAt: string; revokedAt: string | null; revokeCause: string | null; batchId: string | null }[];
  editLog: { at: string; action: string; fields: string[] }[]; accountSelfConsent: boolean;
  family: { id: string; label: string; guardianName: string | null; guardianPhone: string | null; members: { id: string; name: string }[]; hiddenMembers: number } | null;
}
const ACTION_LABEL: Record<string, string> = {
  "student_profile.create": "Tạo hồ sơ", "student_profile.update": "Sửa", "student_profile.consent": "Ghi thêm đồng ý", "student_profile.revoke": "Thu hồi đồng ý", "student_profile.import": "Nhập hàng loạt",
};
const CAUSE_LABEL: Record<string, string> = { guardian_request: "theo yêu cầu của phụ huynh", child_request: "theo yêu cầu của em", tutor_decision: "do gia sư quyết định", profile_deleted: "hồ sơ đã bị xoá" };
const EXT = ["birthDate", "address", "phone", "phoneExtra", "email", "emailExtra", "startDate", "subjects", "notes"] as const;

export default function HoSoHocSinh({ id }: { id: string }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [d, setD] = useState<Detail | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string; capacity: number | null; filled: number }[]>([]);
  const [families, setFamilies] = useState<{ id: string; label: string }[]>([]);
  const [newFam, setNewFam] = useState<{ label: string; guardianName: string; guardianPhone: string } | null>(null);
  const [famErr, setFamErr] = useState("");
  const [defs, setDefs] = useState<{ id: string; label: string }[]>([]);
  const [state, setState] = useState<"load" | "ok" | "err" | "404" | "403">("load");
  const [f, setF] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const [need, setNeed] = useState<{ parties: ConsentParty[]; scopes: ConsentScope[] } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const fill = useCallback((p: any) => {
    setF({
      name: p.name ?? "", ageGroup: p.ageGroup ?? "", status: p.status ?? "active", courseId: p.courseId ?? "", guardianName: p.guardianName ?? "", guardianPhone: p.guardianPhone ?? "",
      familyId: p.familyId ?? "", birthDate: keyToVn(p.birthDate), address: p.address ?? "", phone: p.phone ?? "", phoneExtra: p.phoneExtra ?? "", email: p.email ?? "", emailExtra: p.emailExtra ?? "",
      startDate: keyToVn(p.startDate), subjects: (p.subjects ?? []).join(", "), notes: p.notes ?? "",
    });
    setCustom(p.customData ?? {});
  }, []);

  // Tải hồ sơ + danh sách lớp / trường tuỳ chỉnh. Hàm thuần trả kết quả; nơi gọi đặt state (effect không gọi setState đồng bộ).
  const fetchAll = useCallback(async () => {
    const [a, b] = await Promise.all([jfetch(`/api/tutor/ho-so/${id}`), jfetch("/api/tutor/ho-so")]);
    return { a, b };
  }, [id]);
  const apply = useCallback(({ a, b }: Awaited<ReturnType<typeof fetchAll>>) => {
    if (a.status === 404) { setState("404"); return; }
    if (a.status === 403) { setState("403"); return; }
    if (!a.ok || !b.ok) { setState("err"); return; }
    setD(a.json); setCourses(b.json.courses ?? []); setDefs(b.json.fieldDefs ?? []); setFamilies(b.json.families ?? []);
    fill(a.json.profile); setState("ok");
  }, [fill]);
  const load = useCallback(() => { fetchAll().then(apply); }, [fetchAll, apply]);
  const retry = useCallback(() => { setState("load"); load(); }, [load]);
  useEffect(() => {
    let alive = true;
    fetchAll().then(res => { if (alive) apply(res); });
    return () => { alive = false; };
  }, [fetchAll, apply]);

  const p = d?.profile;
  const locked = p?.consentLevel === "locked";
  const kind = p?.consent ? p.consent.kind as "child" | "adult" : "child";

  async function save() {
    if (busy) return;
    setBusy(true); setMsg(null); setErrors({});
    const body: Record<string, unknown> = {
      name: f.name, ageGroup: f.ageGroup, status: f.status, courseId: f.courseId || null, guardianName: f.guardianName, guardianPhone: f.guardianPhone,
      subjects: f.subjects,
      ...(f.familyId !== (d?.profile.familyId ?? "") ? { familyId: f.familyId || null } : {}),
    };
    for (const k of EXT) if (k !== "subjects") body[k] = f[k] ?? "";
    body.customData = Object.fromEntries(Object.entries(custom).filter(([, v]) => v.trim()));
    if (need) body.consent = { ...consentBody(consent), scopes: [...new Set([...consent.scopes, ...need.scopes])] };
    const r = await jfetch(`/api/tutor/ho-so/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) {
      setNeed(null); setConsent(EMPTY_CONSENT);
      setMsg({ tone: "ok", text: r.json.changed.length ? `Đã lưu. Trường đã đổi: ${r.json.changed.map((k: string) => FIELD_LABEL[k] ?? k).join(", ")}.` : "Không có gì thay đổi." });
      void load(); return;
    }
    if (r.status === 422 && r.json?.needsConsent) {
      setNeed({ parties: r.json.required.filter((x: ConsentParty) => r.json.missing.includes(x)), scopes: r.json.scopesMissing });
      setMsg({ tone: "err", text: "Cần xác nhận đồng ý trước khi lưu thay đổi này. Tích các ô trong hộp xác nhận rồi bấm Lưu lại." }); return;
    }
    if (r.status === 400 && r.json?.errors) setErrors(r.json.errors);
    setMsg({ tone: "err", text: r.json?.error ?? "Chưa lưu được, thử lại nhé." });
  }

  /** LO-14: xếp em đang chờ vào lớp (đổi sang Hoạt động + gán lớp). Chỉ cảnh báo khi lớp đã đủ chỗ, không chặn. */
  async function placeInClass() {
    if (!f.courseId) { setMsg({ tone: "err", text: "Chọn lớp để xếp em vào." }); return; }
    setBusy(true); setMsg(null);
    const r = await jfetch(`/api/tutor/ho-so/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active", courseId: f.courseId }) });
    setBusy(false);
    if (r.ok) { setMsg({ tone: "ok", text: "Đã xếp em vào lớp." }); load(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa xếp được, thử lại nhé." });
  }

  /** HS-12: tạo gia đình mới (nhãn + liên hệ phụ huynh chung) rồi chọn luôn; gắn thật khi bấm Lưu (cần phạm vi đồng ý “anh chị em”). */
  async function createFamily() {
    if (!newFam) return;
    setFamErr("");
    const r = await jfetch("/api/tutor/gia-dinh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newFam) });
    if (r.status === 201) { setFamilies(prev => [...prev, r.json.family]); setF(prev => ({ ...prev, familyId: r.json.family.id })); setNewFam(null); }
    else setFamErr(r.json?.error ?? "Chưa tạo được gia đình.");
  }

  async function reconsent() {
    setBusy(true); setMsg(null);
    const r = await jfetch(`/api/tutor/ho-so/${id}/dong-y`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consentBody(consent)) });
    setBusy(false);
    if (r.ok) { setConsent(EMPTY_CONSENT); setMsg({ tone: "ok", text: "Đã ghi đồng ý." }); void load(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa ghi được đồng ý." });
  }

  async function revoke(party: ConsentParty) {
    const ok = await ask({ title: `Thu hồi đồng ý của ${PARTY_LABEL[party].toLowerCase()}?`, message: REVOKE_NOTE, confirmLabel: "Thu hồi đồng ý" });
    if (!ok) return;
    const r = await jfetch(`/api/tutor/ho-so/${id}/thu-hoi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ party, cause: party === "child" ? "child_request" : "guardian_request" }) });
    if (r.ok) { setMsg({ tone: "ok", text: "Đã thu hồi đồng ý. Thông tin của em đã được ẩn." }); void load(); } else setMsg({ tone: "err", text: r.json?.error ?? "Chưa thu hồi được." });
  }

  async function remove() {
    const ok = await ask({ title: "Xoá hồ sơ này?", message: "Xoá hẳn hồ sơ và mọi thông tin đã ghi về em. Sổ đồng ý được giữ lại (không chứa tên em). Không hoàn tác được.", confirmLabel: "Xoá hồ sơ" });
    if (!ok) return;
    const r = await jfetch(`/api/tutor/ho-so/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/lop-cua-toi/hoc-sinh"); else setMsg({ tone: "err", text: r.json?.error ?? "Chưa xoá được." });
  }

  if (state === "load") return <KinPageSkeleton label="Đang tải hồ sơ học sinh" side={false} />;
  if (state === "404" || state === "403") {
    return (
      <KinPage><KinPageHeader title={state === "404" ? "Không tìm thấy hồ sơ" : "Hồ sơ này không thuộc lớp của bạn"} back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} />
        <p className="text-[var(--kin-chu-mo)]">{state === "404" ? "Hồ sơ có thể đã bị xoá." : "Bạn chỉ xem và sửa được học sinh trong lớp của mình."}</p></KinPage>
    );
  }
  if (state === "err" || !d) return <KinPage><KinPageHeader title="Hồ sơ học sinh" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} /><ErrorStrip message="Không tải được hồ sơ." onRetry={retry} /></KinPage>;

  const c = p.consent as { required: ConsentParty[]; ok: Record<ConsentScope, boolean>; missingBasic: ConsentParty[]; missingExtended: ConsentParty[]; revoked: ConsentParty[]; conflict: boolean };
  const level = locked ? "Đã ẩn: thiếu đồng ý" : p.consentLevel === "basic_only" ? "Mới đủ đồng ý cho thông tin cơ bản" : "Đủ đồng ý";
  const activeParties = [...new Set(d.ledger.filter(r => !r.revokedAt).map(r => r.party))];

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title={p.name} back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }}
        sub={<><span data-profile-kind>{kind === "adult" ? "Người lớn" : "Con"}</span>{" · "}<span data-profile-status>{STATUS_LABEL[(p.status ?? "active") as ProfileStatus] ?? ""}</span>{" · "}Người thanh toán: {payerLabel(kind, p.guardianName)}</>} />

      <div className="max-w-[720px] space-y-6">
        <p data-consent-level>
          <KinStatus tone={locked ? "loi" : p.consentLevel === "full" ? "xong" : "cho"}>{level}</KinStatus>
        </p>
        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}>{msg.text}</p>}

        {locked ? (
          <section data-locked>
            <KinCallout title="Thông tin của em đang được ẩn">
              {c.revoked.length ? `${c.revoked.map(x => PARTY_LABEL[x]).join(", ")} đã thu hồi đồng ý. ` : "Hồ sơ chưa đủ đồng ý. "}
              Bạn không xem hay sửa được các thông tin khác cho tới khi có đồng ý lại. Muốn xoá hẳn, bấm “Xoá hồ sơ”.
            </KinCallout>
            <div className="mt-4 space-y-3">
              <ConsentBox parties={c.missingBasic.length ? c.missingBasic : c.required} value={consent} onChange={setConsent} optionalScopes={["extended"]} id="reconsent" />
              <button type="button" disabled={busy || !consent.scopes.length || ![consent.guardian, consent.child, consent.self].some(Boolean)} onClick={reconsent} className={kinButtonClass("primary")}>Ghi đồng ý lại</button>
            </div>
          </section>
        ) : (
          <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-5" aria-label="Sửa hồ sơ học sinh">
            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Thông tin cơ bản</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Tên em" required value={f.name} onChange={set("name")} error={errors.name} maxLength={60} />
              <SelectField label="Trạng thái" value={f.status} onChange={set("status")}>
                <option value="active">Hoạt động</option><option value="inactive">Không hoạt động</option><option value="waitlist">Đang chờ xếp lớp</option>
              </SelectField>
              <SelectField label="Lớp" value={f.courseId} onChange={set("courseId")}>
                <option value="">Chưa xếp lớp</option>{courses.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </SelectField>
              <SelectField label="Nhóm tuổi" value={f.ageGroup} onChange={set("ageGroup")} hint={p.consent.conflict ? "Ngày sinh và nhóm tuổi chưa khớp: KiN dùng nhóm đòi nhiều đồng ý hơn." : undefined}>
                {(["u7", "7to15", "16plus"] as const).map(g => <option key={g} value={g}>{AGE_GROUP_LABEL[g]}</option>)}
              </SelectField>
              <TextField label={kind === "adult" ? "Tên liên hệ" : "Tên phụ huynh"} value={f.guardianName} onChange={set("guardianName")} error={errors.guardianName} maxLength={60} />
              <TextField label={kind === "adult" ? "Số Zalo / điện thoại liên hệ" : "Số Zalo / điện thoại phụ huynh"} type="tel" inputMode="tel" value={f.guardianPhone} onChange={set("guardianPhone")} error={errors.guardianPhone} />
            </div>

            {p.status === "waitlist" && (
              <KinCallout title={`Em đang chờ xếp lớp${p.waitlistedAt ? ` từ ngày ${fmtVnDate(p.waitlistedAt)}` : ""}`}>
                {(() => { const c = courses.find(x => x.id === f.courseId); return c ? (c.capacity !== null && c.filled >= c.capacity ? `Lớp ${c.name} đã đủ chỗ (${c.filled}/${c.capacity}). Bạn vẫn xếp được nếu muốn.` : `Lớp ${c.name}: ${c.filled}${c.capacity !== null ? `/${c.capacity}` : ""} em đang học.`) : "Chọn lớp ở ô “Lớp” rồi bấm Xếp vào lớp."; })()}
                <span className="block mt-2"><button type="button" data-place disabled={busy || !f.courseId} onClick={placeInClass} className={kinButtonClass("secondary")}>Xếp vào lớp</button></span>
              </KinCallout>
            )}

            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium pt-2">Gia đình (chung liên hệ)</h2>
            <div data-family className="grid gap-3">
              <SelectField label="Gia đình" value={f.familyId ?? ""} onChange={set("familyId")} hint="Anh chị em cùng nhà dùng chung liên hệ phụ huynh. KiN không gộp phiếu học phí theo gia đình.">
                <option value="">Không thuộc gia đình nào</option>
                {families.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </SelectField>
              {d.family && (
                <div data-family-info className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
                  <p>Liên hệ chung của {d.family.label}: {d.family.guardianName || "chưa ghi tên"}{d.family.guardianPhone ? `, ${d.family.guardianPhone}` : ""}.</p>
                  <p>Anh chị em: {d.family.members.length ? d.family.members.map(m => m.name).join(", ") : "chưa có em nào khác"}{d.family.hiddenMembers ? ` (và ${d.family.hiddenMembers} em chưa đủ đồng ý để hiện)` : ""}.</p>
                </div>
              )}
              {newFam ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField label="Tên gia đình" value={newFam.label} onChange={v => setNewFam({ ...newFam, label: v })} maxLength={40} />
                  <TextField label="Tên phụ huynh" value={newFam.guardianName} onChange={v => setNewFam({ ...newFam, guardianName: v })} maxLength={60} />
                  <TextField label="Số Zalo phụ huynh" type="tel" inputMode="tel" value={newFam.guardianPhone} onChange={v => setNewFam({ ...newFam, guardianPhone: v })} />
                  <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={createFamily} disabled={!newFam.label.trim()} className={kinButtonClass("secondary")}>Tạo gia đình</button>
                    <button type="button" onClick={() => { setNewFam(null); setFamErr(""); }} className={kinButtonClass("ghost")}>Huỷ</button>
                    {famErr && <span role="alert" className="text-[var(--kin-tt-chu-loi)]">{famErr}</span>}
                  </div>
                </div>
              ) : (
                <div><button type="button" data-new-family onClick={() => setNewFam({ label: "", guardianName: "", guardianPhone: "" })} className={kinButtonClass("secondary")}>Tạo gia đình mới</button></div>
              )}
            </div>

            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium pt-2">Thông tin mở rộng</h2>
            {p.consentLevel === "basic_only" && (
              <KinCallout title="Chưa có đồng ý cho thông tin mở rộng">Bạn chưa xem hay ghi được ngày sinh, địa chỉ, số điện thoại, ghi chú. Điền vào đây rồi lưu, KiN sẽ hỏi xác nhận thêm.</KinCallout>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Ngày sinh" placeholder="15/03/2014" inputMode="numeric" value={f.birthDate} onChange={set("birthDate")} error={errors.birthDate} />
              <TextField label="Ngày bắt đầu học" placeholder="01/11/2026" inputMode="numeric" value={f.startDate} onChange={set("startDate")} error={errors.startDate} />
              <TextField label="Số điện thoại của em" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
              <TextField label="Số điện thoại thứ ba" type="tel" inputMode="tel" value={f.phoneExtra} onChange={set("phoneExtra")} error={errors.phoneExtra} />
              <TextField label="Email" type="email" inputMode="email" value={f.email} onChange={set("email")} error={errors.email} />
              <TextField label="Email bổ sung" type="email" inputMode="email" value={f.emailExtra} onChange={set("emailExtra")} error={errors.emailExtra} />
            </div>
            <TextField label="Địa chỉ" value={f.address} onChange={set("address")} error={errors.address} maxLength={200} />
            <TextField label="Môn học" value={f.subjects} onChange={set("subjects")} error={errors.subjects} hint="Cách nhau bằng dấu phẩy, tối đa 5 môn." />
            <TextArea label="Ghi chú" value={f.notes} onChange={set("notes")} error={errors.notes} maxLength={500} />
            {defs.map(x => <TextField key={x.id} label={x.label} value={custom[x.id] ?? ""} onChange={v => setCustom(prev => ({ ...prev, [x.id]: v }))} maxLength={200} />)}
            <p className="text-[length:var(--kin-co-goc)]"><Link href="/lop-cua-toi/hoc-sinh/truong" className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">Quản lý trường tuỳ chỉnh</Link></p>

            {need && (
              <ConsentBox parties={need.parties} value={consent} onChange={setConsent} forcedScopes={["basic", ...need.scopes]} id="edit-consent" />
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className={kinButtonClass("primary")}>{busy ? "Đang lưu…" : need ? "Lưu lại kèm xác nhận" : "Lưu thay đổi"}</button>
            </div>
          </form>
        )}

        <section aria-label="Sổ đồng ý" data-ledger>
          <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Sổ đồng ý</h2>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Gia sư tự xác nhận đã có đồng ý; KiN ghi lại và không kiểm tra giấy tờ, nên đây không phải “đã xác minh”.</p>
          {d.ledger.length === 0 ? <p className="mt-2 text-[var(--kin-chu-mo)]">Chưa có dòng đồng ý nào.</p> : (
            <ul className="mt-2 divide-y divide-[var(--kin-vien-nhat)]">
              {d.ledger.map(r => (
                <li key={r.id} data-ledger-row className="py-3 text-[length:var(--kin-co-goc)] leading-5">
                  <p className="font-medium">{PARTY_LABEL[r.party]} · {r.scopes.map(s => SCOPE_LABEL[s].label).join(", ")}</p>
                  <p className="text-[var(--kin-chu-mo)]">Gia sư xác nhận lúc {fmtVnDateTime(r.grantedAt)} · bản chữ {r.textVersion}{r.batchId ? " · nhập hàng loạt" : ""}</p>
                  <p><KinStatus tone={r.revokedAt ? "cho" : "xong"}>{r.revokedAt ? `Đã thu hồi ${fmtVnDateTime(r.revokedAt)}${r.revokeCause ? ` (${CAUSE_LABEL[r.revokeCause] ?? ""})` : ""}` : "Còn hiệu lực"}</KinStatus></p>
                </li>
              ))}
            </ul>
          )}
          {activeParties.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {activeParties.map(party => <button key={party} type="button" onClick={() => revoke(party)} className={kinButtonClass("secondary")}>Thu hồi đồng ý của {PARTY_LABEL[party].toLowerCase()}</button>)}
            </div>
          )}
          {d.accountSelfConsent && <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Em đã tự đồng ý trong tài khoản của em.</p>}
        </section>

        <section aria-label="Nhật ký sửa" data-edit-log>
          <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Nhật ký sửa</h2>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chỉ ghi bạn đã sửa trường nào và lúc nào, không ghi nội dung.</p>
          {d.editLog.length === 0 ? <p className="mt-2 text-[var(--kin-chu-mo)]">Chưa có thay đổi nào.</p> : (
            <ul className="mt-2 divide-y divide-[var(--kin-vien-nhat)]">
              {d.editLog.map((e, i) => (
                <li key={i} className="py-2 text-[length:var(--kin-co-goc)]">
                  <span className="text-[var(--kin-chu-mo)] tabular-nums">{fmtVnDateTime(e.at)}</span>{" · "}{ACTION_LABEL[e.action] ?? e.action}
                  {e.fields.length > 0 && <>{": "}{e.fields.map(k => FIELD_LABEL[k] ?? k).join(", ")}</>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Xoá hồ sơ" className="pt-2">
          <button type="button" onClick={remove} className={kinButtonClass("danger")}>Xoá hồ sơ</button>
        </section>
      </div>
    </KinPage>
  );
}

