// TUT-dong-giang 7.1 — hộp thoại "Mời giáo viên" (chủ lớp). Mời theo email, chọn vai, nhãn môn.
// Sau khi gửi luôn hiện một câu chung (INVITE_SENT_TEXT): không báo email có tồn tại, có phải gia sư hay không (chống dò email).
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { Modal, callApi } from "@/components/tutor/shared";
import { EMAIL_RE, INVITE_SENT_TEXT, ROLE_LABEL, TEACH_ROLE_HINT, errorText, parseSubjects, type TeachRole } from "@/components/tutor/dongGiangUi";

export default function MoiDongGiang({ courseId, onClose, onSent }: { courseId: string; onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeachRole>("co_teacher");
  const [subjects, setSubjects] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { setErr("Email chưa đúng dạng, ví dụ co.lan@gmail.com."); return; }
    setErr(null); setBusy(true);
    const r = await callApi<{ code?: string }>(`/api/tutor/lop/${encodeURIComponent(courseId)}/giao-vien`, {
      method: "POST", body: JSON.stringify({ email: em, role, subjects: parseSubjects(subjects) }),
    });
    setBusy(false);
    if (!r.ok) { setErr(errorText(r.status, r.data.code, r.data.error)); return; }
    setSent(true); onSent();
  }

  return (
    <Modal title="Mời giáo viên cùng dạy" onClose={onClose} labelledBy="moi-dg-title">
      {sent ? (
        <div className="space-y-4">
          <p role="status" data-moi-dg-xong className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">{INVITE_SENT_TEXT}</p>
          <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Khi giáo viên nhận lời, tên sẽ hiện trong danh sách. Trước đó danh sách chỉ ghi &quot;Chờ nhận lời&quot;.</p>
          <div className="flex gap-2 justify-end flex-wrap">
            <KinButton variant="secondary" onClick={() => { setSent(false); setEmail(""); setSubjects(""); }}>Mời thêm người</KinButton>
            <KinButton onClick={onClose}>Xong</KinButton>
          </div>
        </div>
      ) : (
        <form onSubmit={e => void submit(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="moi-dg-email" className={KIN_LABEL}>Email của giáo viên</label>
            <input id="moi-dg-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} className={`${KIN_FIELD} mt-2`} placeholder="giaovien@gmail.com" />
            <p className="mt-2 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Phải là email giáo viên đã dùng để đăng ký gia sư trên KiN.</p>
          </div>
          <fieldset>
            <legend className={KIN_LABEL}>Vai trong lớp</legend>
            <div className="mt-2 space-y-2">
              {(["co_teacher", "subject_teacher"] as const).map(v => (
                <label key={v} className={`flex items-start gap-3 min-h-11 p-3 rounded-[var(--kin-bo-md)] border cursor-pointer ${role === v ? "border-[var(--kin-nhan-diem)] bg-[var(--kin-nen-nhan)]" : "border-[var(--kin-vien-o-nhap)]"}`}>
                  <input type="radio" name="moi-dg-role" value={v} checked={role === v} onChange={() => setRole(v)} className="mt-1" />
                  <span className="min-w-0 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
                    <b className="font-medium">{ROLE_LABEL[v]}</b> — {TEACH_ROLE_HINT[v]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="moi-dg-mon" className={KIN_LABEL}>Môn phụ trách (không bắt buộc)</label>
            <input id="moi-dg-mon" value={subjects} onChange={e => setSubjects(e.target.value)} className={`${KIN_FIELD} mt-2`} placeholder="Ví dụ: Toán, Lý" maxLength={220} />
            <p className="mt-2 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Chỉ để hiển thị cho dễ nhìn. Quyền soạn bài theo nhóm bài cô giao ở Giáo trình.</p>
          </div>
          {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
          <div className="flex gap-2 justify-end flex-wrap">
            <KinButton type="button" variant="secondary" onClick={onClose} disabled={busy}>Huỷ</KinButton>
            <KinButton type="submit" loading={busy} loadingLabel="Đang gửi…">Gửi lời mời</KinButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
