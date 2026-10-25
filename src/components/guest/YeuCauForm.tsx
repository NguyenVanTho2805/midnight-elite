// KH-04 — biểu mẫu "Yêu cầu tìm gia sư" của khách, gửi tới MỘT gia sư. Chỉ thu tối thiểu; KHÔNG thu tên / ngày sinh / trường của trẻ.
// Hộp đồng ý KHÔNG tích sẵn, chữ nói thật (KiN không xác minh người bấm). Chống spam: ô bẫy ẩn, thời gian điền tối thiểu, giới hạn máy chủ.
// Sau khi gửi: link theo dõi (PH-07). CHƯA có ý kiến luật sư.
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KIN_LABEL } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { KinCallout } from "@/components/kin/Callout";
import { LEVEL_LABEL, NOTE_MAX, REQUEST_CONSENT_NOTE, REQUEST_CONSENT_TEXT, REQUEST_LEVELS, type RequesterRole } from "@/lib/tutorRequest";
import { MODE_LABEL, TEACHING_MODES } from "@/lib/tutorArea";
import { RadioCards, SelectField, TextArea, TextField, jfetch } from "@/components/tutor/studentUi";

export default function YeuCauForm({ tutorId, tutorName }: { tutorId: string; tutorName: string }) {
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const [role, setRole] = useState<RequesterRole | "">("");
  const [f, setF] = useState({ level: "", subject: "", mode: "", slots: "", note: "", contactName: "", contactPhone: "", website: "" });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !role) return;
    setBusy(true); setMsg(""); setErrors({});
    const r = await jfetch("/api/yeu-cau", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTutorId: tutorId, ...f, role, consent: { accepted }, startedAt: startedAt.current }),
    });
    setBusy(false);
    if (r.status === 201) { setDone(r.json.trackToken); return; }
    if (r.status === 400 && r.json?.errors) setErrors(r.json.errors);
    setMsg(r.json?.error ?? (r.status === 0 ? "Không kết nối được. Kiểm tra mạng rồi thử lại." : "Chưa gửi được, thử lại nhé."));
  }

  if (done) {
    const link = (typeof window !== "undefined" ? window.location.origin : "") + `/yeu-cau/${done}`;
    return (
      <div role="status" data-sent className="max-w-[640px] space-y-4">
        <KinCallout tone="nhan" title={`Đã gửi yêu cầu tới ${tutorName}`}>
          KiN đã chuyển yêu cầu tới gia sư. Gia sư sẽ liên hệ qua số Zalo anh/chị đã để lại. KiN chưa biết gia sư có nhận hay không; trạng thái sẽ hiện ở trang theo dõi.
        </KinCallout>
        <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">Giữ link này để theo dõi hoặc rút yêu cầu. Ai có link đều xem được trạng thái (không có số liên hệ).</p>
        <p data-track-link className="break-all text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{link}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/yeu-cau/${done}`} className={kinButtonClass("primary")}>Mở trang theo dõi</Link>
          <KinCopyButton appearance="button" buttonVariant="secondary" text={link} label="Chép link theo dõi" copiedLabel="Đã chép link">Chép link theo dõi</KinCopyButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-[640px] space-y-5" aria-label="Yêu cầu tìm gia sư" noValidate>
      <KinCallout title="Chỉ cần vài thông tin">KiN chỉ chuyển những gì anh/chị điền dưới đây cho {tutorName}. Không cần tên, ngày sinh hay trường của con. Không cần tài khoản.</KinCallout>
      <RadioCards name="role" legend="Anh/chị là" value={role} onChange={setRole} options={[
        { key: "guardian", title: "Phụ huynh / người giám hộ", sub: "Tìm gia sư cho con" }, { key: "self", title: "Người học (đủ 16 tuổi)", sub: "Tự tìm gia sư cho mình" }]} />
      {errors.role && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{errors.role}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Cấp học" value={f.level} onChange={set("level")}>
          <option value="">Chọn cấp học</option>
          {REQUEST_LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </SelectField>
        <TextField label="Môn cần học" required value={f.subject} onChange={set("subject")} error={errors.subject} maxLength={60} />
        <SelectField label="Hình thức học" value={f.mode} onChange={set("mode")}>
          <option value="">Chưa chọn</option>
          {TEACHING_MODES.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
        </SelectField>
        <TextField label="Khung giờ có thể học" value={f.slots} onChange={set("slots")} error={errors.slots} maxLength={120} placeholder="Ví dụ: tối thứ 3, 5, 7" />
      </div>
      {errors.level && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{errors.level}</p>}
      <TextArea label="Ghi chú (không bắt buộc)" value={f.note} onChange={set("note")} error={errors.note} maxLength={NOTE_MAX} hint="Đừng ghi tên hay ngày sinh của con. Chỉ ghi điều gia sư cần biết để sắp lịch." />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Tên anh/chị (không bắt buộc)" value={f.contactName} onChange={set("contactName")} error={errors.contactName} maxLength={60} autoComplete="name" />
        <TextField label="Số Zalo / điện thoại" required type="tel" inputMode="tel" value={f.contactPhone} onChange={set("contactPhone")} error={errors.contactPhone} hint="10 chữ số. Chỉ gia sư bạn chọn thấy số này." autoComplete="tel" />
      </div>

      {/* Ô bẫy cho bot: người thật không thấy, không tab tới được. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set("website")(e.target.value)} /></label>
      </div>

      <fieldset data-request-consent className="border border-[var(--kin-vien-o-nhap)] rounded-[var(--kin-bo-md)] px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-trang)]">
        <legend className={`${KIN_LABEL} px-1 font-medium`}>Đồng ý trước khi gửi</legend>
        <label className="flex items-start gap-3 min-h-11 py-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
          <input type="checkbox" data-request-accept checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>{role ? REQUEST_CONSENT_TEXT[role] : "Chọn anh/chị là phụ huynh hay người học ở trên để xem nội dung đồng ý."}</span>
        </label>
        <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{REQUEST_CONSENT_NOTE}</p>
      </fieldset>

      <div role="note" className="p-4 text-[length:var(--kin-co-goc)]" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
        Không chuyển khoản trước buổi học thử. KiN không thu phí kết nối và không thu hộ học phí.
      </div>

      {msg && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{msg}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" data-request-submit disabled={busy || !accepted || !role} className={kinButtonClass("primary")}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</button>
        <Link href={`/mentor/${tutorId}`} className={kinButtonClass("secondary")}>Quay lại hồ sơ</Link>
      </div>
      {(!accepted || !role) && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chọn vai và tích ô đồng ý thì mới gửi được.</p>}
    </form>
  );
}
