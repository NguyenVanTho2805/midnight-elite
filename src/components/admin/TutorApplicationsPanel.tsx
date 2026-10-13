// FE-138 — danh sách hồ sơ gia sư để quản lý trung tâm duyệt / từ chối.
// API đã có từ 1.4.4: GET /api/admin/tutor-applications?status=…,
// POST …/[userId]/approve, POST …/[userId]/reject { reason }.
// Dùng ở /admin/ho-so-gia-su và tab "Hồ sơ gia sư" trong /admin/quan-tri-vien.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";

type Status = "pending" | "approved" | "rejected";

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  emailVerified: boolean;
  bio: string | null;
  subjects: string[];
  tutorAppliedAt: string | null;
  tutorVerifiedAt: string | null;
  tutorRejectedAt: string | null;
  tutorRejectReason: string | null;
}

const REASON_MAX = 500;
const BIO_PREVIEW = 220;

const STATUS_LABEL: Record<Status, string> = {
  pending:  "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString("vi-VN") : "—";
}

export default function TutorApplicationsPanel({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const toast = useToast();
  const [status, setStatus]     = useState<Status>("pending");
  const [items, setItems]       = useState<Application[]>([]);
  const [loading, setLoading]   = useState(true);
  const [failed, setFailed]     = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [openBio, setOpenBio]   = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason]     = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const reqSeq = useRef(0); // bỏ kết quả của request cũ khi người dùng đổi tab nhanh

  const load = useCallback(async (s: Status) => {
    await Promise.resolve();
    const seq = ++reqSeq.current;
    setLoading(true); setFailed(false);
    try {
      const r = await fetch(`/api/admin/tutor-applications?status=${s}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const list: Application[] = d.applications ?? [];
      if (s === "pending") onPendingCount?.(list.length); // số chờ luôn đúng dù đang ở tab khác
      if (seq !== reqSeq.current) return;
      setItems(list);
    } catch {
      if (seq === reqSeq.current) setFailed(true);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [onPendingCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(status);
  }, [load, status]);

  useEffect(() => {
    if (!rejecting) return;
    reasonRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setRejecting(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rejecting]);

  async function approve(a: Application) {
    setBusyId(a.id);
    try {
      const r = await fetch(`/api/admin/tutor-applications/${a.id}/approve`, { method: "POST", credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.err(d.error ?? "Duyệt thất bại"); await load(status); return; }
      toast.ok(`Đã duyệt ${a.name}. Gia sư cần đăng nhập lại để nhận quyền.`);
      await load(status);
    } catch {
      toast.err("Lỗi kết nối, thử lại sau");
    } finally { setBusyId(null); }
  }

  async function reject() {
    if (!rejecting) return;
    const text = reason.trim();
    if (!text) { toast.err("Vui lòng nêu lý do từ chối"); return; }
    setBusyId(rejecting.id);
    try {
      const r = await fetch(`/api/admin/tutor-applications/${rejecting.id}/reject`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.err(d.error ?? "Từ chối thất bại"); await load(status); setRejecting(null); return; }
      toast.ok(`Đã từ chối hồ sơ của ${rejecting.name}.`);
      setRejecting(null); setReason("");
      await load(status);
    } catch {
      toast.err("Lỗi kết nối, thử lại sau");
    } finally { setBusyId(null); }
  }

  function toggleBio(id: string) {
    setOpenBio(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Trạng thái hồ sơ gia sư">
        {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
            style={status === s
              ? { background: "var(--kin-nhan-nen)", color: "var(--kin-chu-tren-nut-chinh)" }
              : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
            {STATUS_LABEL[s]}{s === "pending" && status === "pending" && !loading && !failed ? ` (${items.length})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map(i => <div key={i} className="h-28 rounded-xl animate-pulse bg-gray-100" />)}
        </div>
      ) : failed ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
          Không tải được danh sách hồ sơ.{" "}
          <button className="underline font-semibold cursor-pointer" onClick={() => load(status)}>Thử lại</button>
        </div>
      ) : items.length === 0 ? (
        <div role="status" className="rounded-xl p-10 text-center text-sm"
          style={{ background: "var(--kin-nen-trang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
          {status === "pending" ? "Không có hồ sơ nào đang chờ duyệt." : `Chưa có hồ sơ ${STATUS_LABEL[status].toLowerCase()}.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(a => {
            const bio = a.bio ?? "";
            const long = bio.length > BIO_PREVIEW;
            const open = openBio.has(a.id);
            const busy = busyId === a.id;
            return (
              <li key={a.id} className="rounded-xl p-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{a.name}</p>
                    <p className="text-xs mt-0.5 break-all" style={{ color: "var(--kin-chu-mo)" }}>
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ""}
                      {a.city ? ` · ${a.city}` : ""}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Nộp lúc {fmt(a.tutorAppliedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!a.emailVerified && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
                        Chưa xác thực email
                      </span>
                    )}
                    {status === "approved" && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
                        Đã duyệt {fmt(a.tutorVerifiedAt)}
                      </span>
                    )}
                    {status === "rejected" && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
                        Từ chối {fmt(a.tutorRejectedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {a.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Môn dạy">
                    {a.subjects.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)" }}>{s}</span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: "var(--kin-chu-phu)" }}>
                  {bio ? (long && !open ? `${bio.slice(0, BIO_PREVIEW)}…` : bio) : <span style={{ color: "var(--kin-chu-mo)" }}>(Chưa viết giới thiệu)</span>}
                </p>
                {long && (
                  <button onClick={() => toggleBio(a.id)} className="mt-1 text-xs font-semibold underline cursor-pointer"
                    style={{ color: "var(--kin-nhan-link)" }} aria-expanded={open}>
                    {open ? "Thu gọn" : "Xem đầy đủ"}
                  </button>
                )}

                {status === "rejected" && a.tutorRejectReason && (
                  <p className="mt-3 text-sm rounded-lg px-3 py-2" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
                    Lý do: {a.tutorRejectReason}
                  </p>
                )}

                {status === "pending" && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <button onClick={() => approve(a)} disabled={busy || !a.emailVerified}
                      title={a.emailVerified ? undefined : "Người nộp đơn chưa xác thực email nên chưa thể duyệt"}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{ background: "var(--kin-nhan-nen)" }}>
                      {busy ? "Đang xử lý…" : "Duyệt"}
                    </button>
                    <button onClick={() => { setRejecting(a); setReason(""); }} disabled={busy}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer"
                      style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                      Từ chối
                    </button>
                    {!a.emailVerified && (
                      <span className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>Cần xác thực email trước khi duyệt.</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={() => setRejecting(null)} role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 id="reject-title" className="text-base font-semibold text-slate-800">Từ chối hồ sơ của {rejecting.name}</h2>
            <p className="mt-1 text-sm text-slate-600">Lý do sẽ được gửi cho người nộp đơn. Tài khoản vẫn là học viên bình thường.</p>
            <label htmlFor="reject-reason" className="sr-only">Lý do từ chối</label>
            <textarea id="reject-reason" ref={reasonRef} value={reason} maxLength={REASON_MAX} rows={4}
              onChange={e => setReason(e.target.value)}
              placeholder="Ví dụ: Giới thiệu chưa nêu kinh nghiệm dạy, vui lòng bổ sung."
              className="mt-3 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400" />
            <p className="text-xs text-right mt-1" style={{ color: "var(--kin-chu-mo)" }}>{reason.length}/{REASON_MAX}</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setRejecting(null)} disabled={busyId === rejecting.id}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer">Hủy</button>
              <button onClick={reject} disabled={busyId === rejecting.id || !reason.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
                style={{ background: "var(--kin-tt-chu-loi)" }}>
                {busyId === rejecting.id ? "Đang gửi…" : "Từ chối hồ sơ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
