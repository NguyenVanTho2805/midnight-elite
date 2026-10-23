// HS-13 — Thêm học sinh, 4 bước: (1) loại + nhóm tuổi · (2) thông tin cơ bản · (3) thông tin thêm (tuỳ chọn) · (4) xem lại + hộp đồng ý.
// Chưa tích đủ hộp đồng ý thì nút Lưu không bấm được, và máy chủ cũng từ chối (422): không có hồ sơ nào được lưu khi thiếu đồng ý.
// Lối vào cũ (mã mời, ghi danh) giữ nguyên: bước 1 có liên kết sang trang Lớp.
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { requiredConsent, type AgeGroup, type ConsentScope } from "@/lib/consentPolicy";
import { payerLabel } from "@/lib/consentPolicy";
import { parseDateInput } from "@/lib/studentProfile";
import ConsentBox, { EMPTY_CONSENT, consentBody, type ConsentValue } from "@/components/tutor/ConsentBox";
import { RadioCards, SelectField, TextArea, TextField, jfetch } from "@/components/tutor/studentUi";

interface Meta { courses: { id: string; name: string }[]; fieldDefs: { id: string; label: string }[] }
const STEPS = ["Loại học sinh", "Thông tin cơ bản", "Thông tin thêm", "Xem lại và xác nhận"];
const EXT_KEYS = ["birthDate", "address", "phone", "phoneExtra", "email", "emailExtra", "startDate", "subjects", "notes"] as const;
const STEP_OF: Record<string, number> = { ageGroup: 0, name: 1, status: 1, courseId: 1, guardianName: 1, guardianPhone: 1, familyId: 1 };

export default function HocSinhWizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const userId = sp.get("userId") || "";
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [group, setGroup] = useState<AgeGroup | "">("");
  const [kind, setKind] = useState<"child" | "adult" | "">("");
  const [f, setF] = useState<Record<string, string>>({ name: "", courseId: "", guardianName: "", guardianPhone: "", status: "active", birthDate: "", address: "", phone: "", phoneExtra: "", email: "", emailExtra: "", startDate: "", subjects: "", notes: "" });
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, b] = await Promise.all([jfetch("/api/tutor/ho-so"), userId ? jfetch("/api/tutor/hoc-sinh") : Promise.resolve(null)]);
      if (!alive) return;
      if (!a.ok) { setLoadErr(true); return; }
      setMeta({ courses: a.json.courses ?? [], fieldDefs: a.json.fieldDefs ?? [] });
      const stu = b?.ok ? (b.json.students as { userId: string; name: string; courseId: string }[]).find(s => s.userId === userId) : null;
      if (stu) setF(p => ({ ...p, name: p.name || stu.name, courseId: p.courseId || stu.courseId }));
    })();
    return () => { alive = false; };
  }, [userId]);

  const hasExt = EXT_KEYS.some(k => f[k]?.trim()) || Object.values(custom).some(v => v.trim());
  const req = useMemo(() => group ? requiredConsent({ declared: group, birthKey: parseDateInput(f.birthDate), now: new Date() }) : null, [group, f.birthDate]);
  const forced: ConsentScope[] = hasExt ? ["basic", "extended"] : ["basic"];
  const scopes = [...new Set([...consent.scopes, ...forced])];
  const allTicked = !!req && req.parties.every(p => consent[p]);

  const pickKind = (k: "child" | "adult") => { setKind(k); setGroup(k === "adult" ? "16plus" : g => (g === "u7" || g === "7to15" ? g : "")); };
  const next = () => {
    setMsg("");
    if (step === 0 && !group) { setErrors({ ageGroup: "Chọn nhóm tuổi của em" }); return; }
    if (step === 1 && !f.name.trim()) { setErrors({ name: "Nhập tên em" }); return; }
    setErrors({}); setStep(s => Math.min(3, s + 1));
  };

  async function save() {
    if (saving) return;
    setSaving(true); setMsg(""); setErrors({});
    const body: Record<string, unknown> = {
      name: f.name, ageGroup: group, status: f.status, courseId: f.courseId || null, guardianName: f.guardianName, guardianPhone: f.guardianPhone, source: "wizard",
      ...(userId ? { userId } : {}), consent: { ...consentBody(consent), scopes },
    };
    for (const k of EXT_KEYS) if (f[k]?.trim()) body[k] = f[k];
    const cd = Object.fromEntries(Object.entries(custom).filter(([, v]) => v.trim()));
    if (Object.keys(cd).length) body.customData = cd;
    const r = await jfetch("/api/tutor/ho-so", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (r.status === 201) { router.push(`/lop-cua-toi/hoc-sinh/${r.json.id}`); return; }
    if (r.status === 400 && r.json?.errors) {
      setErrors(r.json.errors);
      const first = Object.keys(r.json.errors)[0];
      setStep(STEP_OF[first] ?? 2); setMsg(r.json.error); return;
    }
    setMsg(r.status === 422 ? `${r.json?.error ?? "Cần xác nhận đồng ý"}. Hãy tích đủ các ô trong hộp xác nhận.` : r.status === 409 && r.json?.id ? "Bạn đã có hồ sơ riêng cho em này." : r.json?.error ?? "Chưa lưu được, thử lại nhé.");
  }

  return (
    <KinPage>
      <KinPageHeader title="Thêm học sinh" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} sub={`Bước ${step + 1} trên 4: ${STEPS[step]}`} live />
      {loadErr && <div role="alert" className="mb-4 text-[var(--kin-tt-chu-loi)]">Không tải được danh sách lớp. <button type="button" className="underline min-h-11" onClick={() => location.reload()}>Thử lại</button></div>}
      <ol aria-label="Các bước" className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--kin-co-goc)]">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={i === step ? "font-medium text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-mo)]"}>{i + 1}. {s}{i < step ? " (xong)" : ""}</li>)}
      </ol>

      <div className="max-w-[640px] space-y-5">
        {step === 0 && (
          <>
            {userId && <KinCallout title="Hồ sơ riêng về em đã có tài khoản">Em đã học lớp của bạn bằng tài khoản. Đây là hồ sơ riêng của bạn về em, KiN không đổi thông tin tài khoản của em.</KinCallout>}
            <RadioCards name="kind" legend="Học sinh này là" value={kind} onChange={pickKind} options={[
              { key: "child", title: "Con (dưới 16 tuổi)", sub: "Người thanh toán là phụ huynh" }, { key: "adult", title: "Người lớn (từ 16 tuổi)", sub: "Người thanh toán là chính người học" }]} />
            {kind === "child" && (
              <RadioCards name="age" legend="Em bao nhiêu tuổi?" value={group === "u7" || group === "7to15" ? group : ""} onChange={setGroup} options={[
                { key: "u7", title: "Dưới 7 tuổi", sub: "Cần phụ huynh đồng ý" }, { key: "7to15", title: "Từ 7 đến 15 tuổi", sub: "Cần cả phụ huynh và em đồng ý" }]} />
            )}
            {errors.ageGroup && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{errors.ageGroup}</p>}
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Muốn mời em tự tạo tài khoản vào lớp? Dùng mã mời trong <Link href="/lop-cua-toi/lop" className="underline text-[var(--kin-nhan-link)]">trang Lớp</Link>. Hồ sơ ở đây dành cho em chưa có tài khoản.</p>
          </>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <TextField label="Tên em" required value={f.name} onChange={set("name")} error={errors.name} maxLength={60} autoComplete="off" />
            <SelectField label="Lớp" value={f.courseId} onChange={set("courseId")} hint={meta && meta.courses.length === 0 ? "Bạn chưa có lớp. Có thể thêm lớp sau." : undefined}>
              <option value="">Chưa xếp lớp</option>
              {(meta?.courses ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            {kind === "child" && <>
              <TextField label="Tên phụ huynh" value={f.guardianName} onChange={set("guardianName")} error={errors.guardianName} maxLength={60} />
              <TextField label="Số Zalo / điện thoại phụ huynh" type="tel" inputMode="tel" value={f.guardianPhone} onChange={set("guardianPhone")} error={errors.guardianPhone} hint="10 chữ số. Chỉ mình bạn thấy." />
            </>}
            <SelectField label="Trạng thái" value={f.status} onChange={set("status")}>
              <option value="active">Hoạt động</option><option value="inactive">Không hoạt động</option><option value="waitlist">Đang chờ xếp lớp</option>
            </SelectField>
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Người thanh toán: {payerLabel(kind === "adult" ? "adult" : "child", f.guardianName.trim() || null)}.</p>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <KinCallout title="Không bắt buộc">Chỉ điền những gì cần cho việc dạy. Điền ở bước này thì hộp xác nhận sau đó sẽ thêm phạm vi “Thông tin mở rộng”.</KinCallout>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Ngày sinh" placeholder="15/03/2014" inputMode="numeric" value={f.birthDate} onChange={set("birthDate")} error={errors.birthDate} hint="Có ngày sinh thì KiN tính đúng ai phải đồng ý theo tuổi." />
              <TextField label="Ngày bắt đầu học" placeholder="01/11/2026" inputMode="numeric" value={f.startDate} onChange={set("startDate")} error={errors.startDate} />
              <TextField label="Số điện thoại của em" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
              <TextField label="Số điện thoại thứ ba" type="tel" inputMode="tel" value={f.phoneExtra} onChange={set("phoneExtra")} error={errors.phoneExtra} />
              <TextField label="Email" type="email" inputMode="email" value={f.email} onChange={set("email")} error={errors.email} />
              <TextField label="Email bổ sung" type="email" inputMode="email" value={f.emailExtra} onChange={set("emailExtra")} error={errors.emailExtra} />
            </div>
            <TextField label="Địa chỉ" value={f.address} onChange={set("address")} error={errors.address} maxLength={200} />
            <TextField label="Môn học" value={f.subjects} onChange={set("subjects")} error={errors.subjects} hint="Cách nhau bằng dấu phẩy, tối đa 5 môn." />
            <TextArea label="Ghi chú" value={f.notes} onChange={set("notes")} error={errors.notes} maxLength={500} hint="Tối đa 500 ký tự. Chỉ ghi điều cần cho việc dạy." />
            {(meta?.fieldDefs ?? []).map(d => <TextField key={d.id} label={d.label} value={custom[d.id] ?? ""} onChange={v => setCustom(p => ({ ...p, [d.id]: v }))} maxLength={200} />)}
            {errors.customData && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{errors.customData}</p>}
          </div>
        )}

        {step === 3 && req && (
          <div className="grid gap-4">
            <dl data-review className="grid gap-1 text-[length:var(--kin-co-goc)]">
              <div className="flex gap-2"><dt className="w-40 text-[var(--kin-chu-mo)]">Tên</dt><dd className="min-w-0 break-words">{f.name}</dd></div>
              <div className="flex gap-2"><dt className="w-40 text-[var(--kin-chu-mo)]">Loại</dt><dd>{req.kind === "adult" ? "Người lớn" : "Con"}{req.age !== null ? `, ${req.age} tuổi` : ""}</dd></div>
              {f.courseId && <div className="flex gap-2"><dt className="w-40 text-[var(--kin-chu-mo)]">Lớp</dt><dd>{meta?.courses.find(c => c.id === f.courseId)?.name}</dd></div>}
              {hasExt && <div className="flex gap-2"><dt className="w-40 text-[var(--kin-chu-mo)]">Thông tin thêm</dt><dd>Có (cần phạm vi mở rộng)</dd></div>}
            </dl>
            {req.conflict && <KinCallout title="Ngày sinh và nhóm tuổi chưa khớp">KiN dùng nhóm đòi nhiều đồng ý hơn. Quay lại bước 1 hoặc 3 để sửa nếu nhập nhầm.</KinCallout>}
            <ConsentBox parties={req.parties} value={consent} onChange={setConsent} forcedScopes={forced} />
          </div>
        )}

        {msg && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{msg}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          {step > 0 && <button type="button" onClick={() => { setMsg(""); setStep(s => s - 1); }} className={kinButtonClass("secondary")}>Quay lại</button>}
          {step < 3
            ? <button type="button" onClick={next} className={kinButtonClass("primary")}>Tiếp tục</button>
            : <button type="button" onClick={save} disabled={!allTicked || saving} className={kinButtonClass("primary")}>{saving ? "Đang lưu…" : "Lưu hồ sơ"}</button>}
        </div>
        {step === 3 && !allTicked && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tích đủ các ô xác nhận ở trên thì mới lưu được.</p>}
      </div>
    </KinPage>
  );
}
