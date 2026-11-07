// ADM — hai khối thao tác trong panel chi tiết của /admin/hoc-sinh và /admin/gia-su:
//  • DeleteAccountBlock: "Xoá tài khoản" (không hoàn tác) — xác nhận hai bước NGAY TRONG panel, phải gõ XOA mới bật "Xoá vĩnh viễn".
//  • PromoteTutorBlock: "Chuyển thành gia sư" cho học sinh — nhập môn dạy + giới thiệu, nêu rõ hệ quả rồi mới gửi.
// Không hộp thoại mới, không window.confirm. Lỗi 409 của máy chủ hiện NGUYÊN VĂN (không tự dịch). Màu chỉ qua token --kin-*.
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin";
import { useAuth, hasPermission, PERMISSIONS } from "@/contexts/AuthContext";

/** Quyền xoá tài khoản (chỉ admin_super): ẩn khối nếu không có. */
export function useCanDeleteAccounts(): boolean {
  const { user } = useAuth();
  return hasPermission(user, PERMISSIONS.DELETE_ACCOUNTS);
}

const BOX = "rounded-xl border border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)] p-3 space-y-2";
const FIELD = "w-full min-h-11 px-3 py-2 rounded-xl text-sm outline-none border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]";

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: { error?: string; code?: string; activeEnrollments?: number; alreadyDeleted?: boolean } }> {
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!can) return null;
  const who = kind === "students" ? "học sinh" : "gia sư";
  const matched = word.trim().toLowerCase() === "xoa";

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await postJson(`/api/admin/${kind}/${userId}/xoa-tai-khoan`);
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
          <div className="flex gap-2">
            <KinButton variant="secondary" className="flex-1" disabled={busy} onClick={() => { setStep(1); setWord(""); }}>Huỷ</KinButton>
            <KinButton variant="danger-solid" className="flex-1" disabled={!matched} loading={busy} loadingLabel="Đang xoá…" onClick={run}>Xoá vĩnh viễn</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}

export function PromoteTutorBlock({ userId, enrolledCount, onPromoted }: {
  userId: string;
  enrolledCount: number;
  onPromoted: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = Array.from(new Set(subjects.split(",").map(s => s.trim()).filter(Boolean)));
  const valid = list.length >= 1 && bio.length <= 1000;

  async function run() {
    setBusy(true); setErr(null);
    try {
      const body: { subjects: string[]; bio?: string } = { subjects: list };
      if (bio.trim()) body.bio = bio.trim();
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
          <div className="flex gap-2">
            <KinButton variant="secondary" className="flex-1" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>Huỷ</KinButton>
            <KinButton className="flex-1" disabled={!valid} loading={busy} loadingLabel="Đang chuyển…" onClick={run}>Chuyển thành gia sư</KinButton>
          </div>
        </div>
      )}
    </div>
  );
}
