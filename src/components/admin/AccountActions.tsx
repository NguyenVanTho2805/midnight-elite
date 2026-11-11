// ADM — hai khối thao tác trong panel chi tiết của /admin/hoc-sinh và /admin/gia-su:
//  • DeleteAccountBlock: "Xoá tài khoản" (không hoàn tác) — xác nhận hai bước NGAY TRONG panel, phải gõ XOA mới bật "Xoá vĩnh viễn".
//  • PromoteTutorBlock: "Chuyển thành gia sư" cho học sinh — nhập môn dạy + giới thiệu, nêu rõ hệ quả rồi mới gửi.
// Không hộp thoại mới, không window.confirm. Lỗi 409 của máy chủ hiện NGUYÊN VĂN (không tự dịch). Màu chỉ qua token --kin-*.
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin";
import { useAuth, hasPermission, PERMISSIONS } from "@/contexts/AuthContext";
import { KinSelect } from "@/components/kin/KinSelect";

/** Quyền xoá tài khoản (chỉ admin_super): ẩn khối nếu không có. */
export function useCanDeleteAccounts(): boolean {
  const { user } = useAuth();
  return hasPermission(user, PERMISSIONS.DELETE_ACCOUNTS);
}

const BOX = "rounded-xl border border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)] p-3 space-y-2";
const REASONS: { code: string; label: string }[] = [
  { code: "user_request", label: "Người dùng tự yêu cầu" },
  { code: "duplicate", label: "Tài khoản trùng" },
  { code: "spam_or_abuse", label: "Spam hoặc vi phạm" },
  { code: "wrong_account", label: "Tạo nhầm tài khoản" },
  { code: "other", label: "Lý do khác" },
];
const FIELD = "w-full min-h-11 px-3 py-2 rounded-xl text-sm outline-none border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]";

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: { error?: string; code?: string; activeEnrollments?: number; alreadyDeleted?: boolean; found?: boolean; candidateId?: string; shortName?: string; dobKnown?: boolean } }> {
  const res = await fetch(url, {
    method: "POST", credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function DeleteAccountBlock({ kind, userId, onDeleted }: {
  kind: "students" | "tutors";
  userId: string;
  /** Gọi sau khi xoá xong: trang tải lại danh sách, đóng panel, hiện thông báo. */
  onDeleted: (msg: string) => void;
}) {
  const can = useCanDeleteAccounts();
  const [step, setStep] = useState<1 | 2>(1);
  const [word, setWord] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!can) return null;
  const who = kind === "students" ? "học sinh" : "gia sư";
  const matched = word.trim().toLowerCase() === "xoa";

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await postJson(`/api/admin/${kind}/${userId}/xoa-tai-khoan`, reason ? { reason } : undefined);
      if (r.ok) { onDeleted(r.data.alreadyDeleted ? "Tài khoản này đã được xoá từ trước" : "Đã xoá tài khoản"); return; }
      if (r.status === 404) { onDeleted("Tài khoản không còn trong hệ thống"); return; }
      setErr(r.data.error ?? "Chưa xoá được tài khoản. Hãy thử lại.");
      setStep(1); setWord("");
    } catch { setErr("Lỗi kết nối. Hãy thử lại."); }
    finally { setBusy(false); }
  }

  return (
    <div data-xoa-tai-khoan className="space-y-2">
      {err && <p role="alert" data-xoa-loi className="rounded-xl px-3 py-2 text-sm font-semibold bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      {step === 1 ? (
        <KinButton variant="danger" block onClick={() => { setErr(null); setStep(2); }}>Xoá tài khoản</KinButton>
      ) : (
        <div role="group" aria-label="Xoá tài khoản" className={BOX}>
          <p className="text-sm font-bold text-[var(--kin-tt-chu-loi)]">Xoá vĩnh viễn tài khoản {who} này?</p>
          <p className="text-xs text-[var(--kin-tt-chu-loi)]">
            Không hoàn tác được. Thông tin cá nhân (tên, email, số điện thoại, ảnh…) bị xoá. Dữ liệu lớp, điểm danh và phiếu thu được giữ lại làm bằng chứng. Email này dùng lại được để đăng ký tài khoản mới.
          </p>
          <p className="text-xs text-[var(--kin-tt-chu-loi)]">Khác với “Ẩn”: ẩn thì khôi phục được, xoá thì không.</p>
          <label className="block text-xs font-semibold text-[var(--kin-tt-chu-loi)]" htmlFor={`xoa-${userId}`}>Gõ XOA để xác nhận</label>
          <input id={`xoa-${userId}`} data-xoa-input value={word} onChange={e => setWord(e.target.value)} autoComplete="off" className={FIELD} />
          <label className="block text-xs font-semibold text-[var(--kin-tt-chu-loi)]" htmlFor={`ly-do-${userId}`}>Lý do (không bắt buộc)</label>
          <KinSelect id={`ly-do-${userId}`} data-xoa-ly-do value={reason} onChange={v => setReason(v)}>
            <option value="">Không chọn</option>
            {REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </KinSelect>
          <div className="flex gap-2">
            <KinButton variant="secondary" className="flex-1" disabled={busy} onClick={() => { setStep(1); setWord(""); }}>Huỷ</KinButton>
            <KinButton variant="danger-solid" className="flex-1" disabled={!matched} loading={busy} loadingLabel="Đang xoá…" onClick={run}>Xoá vĩnh viễn</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Age18Tick({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-start gap-2 text-xs font-semibold text-[var(--kin-chu-chinh)]">
      <input id={id} data-xac-minh-18 type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
      <span>Tôi đã xác minh người này đủ 18 tuổi</span>
    </label>
  );
}

export function PromoteTutorBlock({ userId, enrolledCount, onPromoted, dobKnown = false }: {
  userId: string;
  enrolledCount: number;
  /** Đã biết ngày sinh thì không cần hộp tick 18 tuổi. Danh sách học sinh không có trường này → mặc định luôn hiện hộp tick. */
  dobKnown?: boolean;
  onPromoted: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState("");
  const [bio, setBio] = useState("");
  const [age18, setAge18] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = Array.from(new Set(subjects.split(",").map(s => s.trim()).filter(Boolean)));
  const valid = list.length >= 1 && bio.length <= 1000 && (dobKnown || age18);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const body: { subjects: string[]; bio?: string; confirmAge18?: boolean } = { subjects: list };
      if (bio.trim()) body.bio = bio.trim();
      if (!dobKnown && age18) body.confirmAge18 = true;
      const r = await postJson(`/api/admin/students/${userId}/len-gia-su`, body);
      if (r.ok) {
        const n = r.data.activeEnrollments ?? enrolledCount;
        onPromoted(n > 0 ? `Đã chuyển thành gia sư. ${n} lớp em đang học vẫn được giữ.` : "Đã chuyển thành gia sư");
        return;
      }
      if (r.status === 404) { onPromoted("Tài khoản không còn trong danh sách học sinh"); return; }
      setErr(r.data.error ?? "Chưa chuyển được. Hãy thử lại.");
    } catch { setErr("Lỗi kết nối. Hãy thử lại."); }
    finally { setBusy(false); }
  }

  return (
    <div data-len-gia-su className="space-y-2">
      {err && <p role="alert" data-len-loi className="rounded-xl px-3 py-2 text-sm font-semibold bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      {!open ? (
        <KinButton variant="secondary" block onClick={() => { setErr(null); setOpen(true); }}>Chuyển thành gia sư</KinButton>
      ) : (
        <div role="group" aria-label="Chuyển thành gia sư" className="rounded-xl border border-[var(--kin-tt-vien-cho)] bg-[var(--kin-tt-nen-cho)] p-3 space-y-2">
          <p className="text-sm font-bold text-[var(--kin-tt-chu-cho)]">Chuyển học sinh này thành gia sư?</p>
          <p className="text-xs text-[var(--kin-tt-chu-cho)]">Lớp em đang học vẫn được giữ. Sau khi chuyển, tài khoản này không còn vào được phần học sinh và cần đăng nhập lại.</p>
          {enrolledCount > 0 && (
            <p data-len-lop className="text-xs font-bold text-[var(--kin-tt-chu-cho)]">Em đang có {enrolledCount} lớp đang học. Các lớp này sẽ được giữ nguyên.</p>
          )}
          <label className="block text-xs font-semibold text-[var(--kin-chu-chinh)]" htmlFor={`mon-${userId}`}>Môn dạy (cách nhau bằng dấu phẩy, ít nhất 1 môn)</label>
          <input id={`mon-${userId}`} data-len-mon value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Toán, Vật lý" className={FIELD} />
          <label className="block text-xs font-semibold text-[var(--kin-chu-chinh)]" htmlFor={`gt-${userId}`}>Giới thiệu (tuỳ chọn, tối đa 1000 chữ)</label>
          <textarea id={`gt-${userId}`} data-len-bio rows={3} maxLength={1000} value={bio} onChange={e => setBio(e.target.value)} className={FIELD + " resize-none"} />
          {!dobKnown && <Age18Tick id={`t18-${userId}`} checked={age18} onChange={setAge18} />}
          <div className="flex gap-2">
            <KinButton variant="secondary" className="flex-1" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>Huỷ</KinButton>
            <KinButton className="flex-1" disabled={!valid} loading={busy} loadingLabel="Đang chuyển…" onClick={run}>Chuyển thành gia sư</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** Chuyển học sinh thành gia sư theo email (admin_super + admin_content). Chỉ hiện tên rút gọn; không liệt kê, không gợi ý. */
export function PromoteByEmailBlock({ onPromoted }: { onPromoted: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<null | { candidateId: string; shortName: string; activeEnrollments: number; dobKnown: boolean } | "none">(null);
  const [subjects, setSubjects] = useState("");
  const [bio, setBio] = useState("");
  const [age18, setAge18] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = Array.from(new Set(subjects.split(",").map(s => s.trim()).filter(Boolean)));
  const cand = found && found !== "none" ? found : null;
  const valid = !!cand && list.length >= 1 && bio.length <= 1000 && (cand.dobKnown || age18);

  function reset() { setFound(null); setSubjects(""); setBio(""); setAge18(false); setStep(1); }

  async function find() {
    setFinding(true); setErr(null); reset();
    try {
      const r = await postJson("/api/admin/gia-su/tim-hoc-sinh", { email: email.trim() });
      if (r.status === 429) { setErr("Tìm quá nhanh, thử lại sau ít phút"); return; }
      if (!r.ok) { setErr(r.data.error ?? "Chưa tìm được. Hãy thử lại."); return; }
      if (r.data.found && r.data.candidateId) {
        setFound({ candidateId: r.data.candidateId, shortName: r.data.shortName ?? "", activeEnrollments: r.data.activeEnrollments ?? 0, dobKnown: !!r.data.dobKnown });
      } else setFound("none");
    } catch { setErr("Lỗi kết nối. Hãy thử lại."); }
    finally { setFinding(false); }
  }

  async function run() {
    if (!cand) return;
    setBusy(true); setErr(null);
    try {
      const body: { subjects: string[]; bio?: string; confirmAge18?: boolean } = { subjects: list };
      if (bio.trim()) body.bio = bio.trim();
      if (!cand.dobKnown && age18) body.confirmAge18 = true;
      const r = await postJson(`/api/admin/students/${cand.candidateId}/len-gia-su`, body);
      if (r.ok) {
        const n = r.data.activeEnrollments ?? cand.activeEnrollments;
        setEmail(""); reset();
        onPromoted(n > 0 ? `Đã chuyển thành gia sư. ${n} lớp em đang học vẫn được giữ.` : "Đã chuyển thành gia sư");
        return;
      }
      if (r.status === 404) { setEmail(""); reset(); onPromoted("Tài khoản không còn trong danh sách học sinh"); return; }
      setErr(r.data.error ?? "Chưa chuyển được. Hãy thử lại.");
      setStep(1);
    } catch { setErr("Lỗi kết nối. Hãy thử lại."); }
    finally { setBusy(false); }
  }

  return (
    <section data-len-email aria-label="Chuyển học sinh thành gia sư theo email" className="space-y-2 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] p-4">
      <h2 className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Chuyển học sinh thành gia sư</h2>
      <p className="text-xs text-[var(--kin-chu-mo)]">Nhập đúng email của học sinh. Hệ thống chỉ báo có hay không, không liệt kê tài khoản.</p>
      {err && <p role="alert" data-len-email-loi className="rounded-xl px-3 py-2 text-sm font-semibold bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <label className="block text-xs font-semibold text-[var(--kin-chu-chinh)]" htmlFor="len-email-in">Email học sinh</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="len-email-in" data-len-email-input type="email" inputMode="email" autoComplete="off" value={email}
          onChange={e => { setEmail(e.target.value); if (found) reset(); }} className={FIELD} />
        <KinButton variant="secondary" disabled={!email.trim() || busy} loading={finding} loadingLabel="Đang tìm…" onClick={find}>Tìm</KinButton>
      </div>
      {found === "none" && <p data-len-email-khong-thay role="status" className="text-sm text-[var(--kin-chu-phu)]">Không tìm thấy học sinh phù hợp</p>}
      {cand && (
        <div data-len-email-ket-qua className="space-y-2">
          <p className="text-sm font-semibold text-[var(--kin-chu-chinh)]">{cand.shortName} · đang học {cand.activeEnrollments} lớp</p>
          {step === 1 ? (
            <>
              <label className="block text-xs font-semibold text-[var(--kin-chu-chinh)]" htmlFor="len-email-mon">Môn dạy (cách nhau bằng dấu phẩy, ít nhất 1 môn)</label>
              <input id="len-email-mon" data-len-email-mon value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Toán, Vật lý" className={FIELD} />
              <label className="block text-xs font-semibold text-[var(--kin-chu-chinh)]" htmlFor="len-email-bio">Giới thiệu (tuỳ chọn, tối đa 1000 chữ)</label>
              <textarea id="len-email-bio" data-len-email-bio rows={3} maxLength={1000} value={bio} onChange={e => setBio(e.target.value)} className={FIELD + " resize-none"} />
              {!cand.dobKnown && <Age18Tick id="len-email-18" checked={age18} onChange={setAge18} />}
              <KinButton disabled={!valid} onClick={() => { setErr(null); setStep(2); }}>Tiếp tục</KinButton>
            </>
          ) : (
            <div role="group" aria-label="Xác nhận chuyển thành gia sư" className="rounded-xl border border-[var(--kin-tt-vien-cho)] bg-[var(--kin-tt-nen-cho)] p-3 space-y-2">
              <p className="text-sm font-bold text-[var(--kin-tt-chu-cho)]">Chuyển {cand.shortName} thành gia sư?</p>
              <p className="text-xs text-[var(--kin-tt-chu-cho)]">Lớp em đang học vẫn được giữ. Sau khi chuyển, tài khoản này không còn vào được phần học sinh và cần đăng nhập lại.</p>
              {cand.activeEnrollments > 0 && <p className="text-xs font-bold text-[var(--kin-tt-chu-cho)]">Em đang có {cand.activeEnrollments} lớp đang học. Các lớp này sẽ được giữ nguyên.</p>}
              <p className="text-xs text-[var(--kin-tt-chu-cho)]">Môn dạy: {list.join(", ")}</p>
              <div className="flex gap-2">
                <KinButton variant="secondary" className="flex-1" disabled={busy} onClick={() => setStep(1)}>Quay lại</KinButton>
                <KinButton className="flex-1" loading={busy} loadingLabel="Đang chuyển…" onClick={run}>Xác nhận chuyển</KinButton>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
