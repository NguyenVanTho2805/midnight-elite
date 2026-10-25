// FE-138 — danh sách hồ sơ gia sư để quản lý trung tâm duyệt / từ chối.
// API đã có từ 1.4.4: GET /api/admin/tutor-applications?status=…,
// POST …/[userId]/approve, POST …/[userId]/reject { reason }.
// Dùng ở /admin/ho-so-gia-su và tab "Hồ sơ gia sư" trong /admin/quan-tri-vien.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { KinButton, KinCallout, KinConfirm, KinEmptyState, KinSkeleton, KinStateCard, KinStatus, KinTabs } from "@/components/kin";

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
    <div className="space-y-2">
      <KinTabs
        label="Trạng thái hồ sơ gia sư"
        value={status}
        onChange={setStatus}
        tabs={(Object.keys(STATUS_LABEL) as Status[]).map(s => ({
          key: s,
          label: `${STATUS_LABEL[s]}${s === "pending" && status === "pending" && !loading && !failed ? ` (${items.length})` : ""}`,
        }))}
      />

      {loading ? (
        <KinStateCard busy kicker="Đang tải" title="Đang tải danh sách hồ sơ" className="mt-4">
          <KinSkeleton />
        </KinStateCard>
      ) : failed ? (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được danh sách" className="mt-4"
          status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
          actions={<KinButton variant="secondary" onClick={() => load(status)}>Thử lại</KinButton>}>
          Không tải được danh sách hồ sơ. Kiểm tra kết nối rồi thử lại.
        </KinStateCard>
      ) : items.length === 0 ? (
        <KinEmptyState title={status === "pending" ? "Không có hồ sơ nào đang chờ duyệt." : `Chưa có hồ sơ ${STATUS_LABEL[status].toLowerCase()}.`}
          action={status === "pending" ? undefined : <KinButton variant="secondary" onClick={() => setStatus("pending")}>Xem hồ sơ chờ duyệt</KinButton>}>
          {status === "pending" ? "Khi có người đăng ký làm gia sư, hồ sơ sẽ hiện ở đây để bạn duyệt." : "Hồ sơ sẽ hiện ở đây sau khi bạn duyệt hoặc từ chối."}
        </KinEmptyState>
      ) : (
        <ul>
          {items.map(a => {
            const bio = a.bio ?? "";
            const long = bio.length > BIO_PREVIEW;
            const open = openBio.has(a.id);
            const busy = busyId === a.id;
            return (
              <li key={a.id} className="py-6 border-b border-[var(--kin-vien-nhat)]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{a.name}</p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] break-all text-[var(--kin-chu-mo)]">
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ""}
                      {a.city ? ` · ${a.city}` : ""}
                    </p>
                    <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nộp lúc {fmt(a.tutorAppliedAt)}</p>
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    {!a.emailVerified && <KinStatus tone="cho">Chưa xác thực email</KinStatus>}
                    {status === "pending" && a.emailVerified && <KinStatus tone="cho">Chờ duyệt</KinStatus>}
                    {status === "approved" && <KinStatus tone="xong">Đã duyệt {fmt(a.tutorVerifiedAt)}</KinStatus>}
                    {status === "rejected" && <KinStatus tone="loi">Từ chối {fmt(a.tutorRejectedAt)}</KinStatus>}
                  </div>
                </div>

                {a.subjects.length > 0 && (
                  <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" aria-label="Môn dạy">
                    <span className="text-[var(--kin-chu-mo)]">Môn dạy: </span>{a.subjects.join(", ")}
                  </p>
                )}

                <p className="mt-3 max-w-[72ch] text-[length:var(--kin-co-goc)] leading-6 whitespace-pre-wrap text-[var(--kin-chu-phu)]">
                  {bio ? (long && !open ? `${bio.slice(0, BIO_PREVIEW)}…` : bio) : <span className="text-[var(--kin-chu-mo)]">(Chưa viết giới thiệu)</span>}
                </p>
                {long && (
                  <button onClick={() => toggleBio(a.id)} className="mt-1 min-h-[44px] text-[length:var(--kin-co-goc)] font-medium underline cursor-pointer text-[var(--kin-nhan-link)]" aria-expanded={open}>
                    {open ? "Thu gọn" : "Xem đầy đủ"}
                  </button>
                )}

                {status === "rejected" && a.tutorRejectReason && (
                  <KinCallout className="mt-3">Lý do: {a.tutorRejectReason}</KinCallout>
                )}

                {status === "pending" && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <KinButton onClick={() => approve(a)} disabled={busy || !a.emailVerified} loading={busy} loadingLabel="Đang xử lý…"
                      title={a.emailVerified ? undefined : "Người nộp đơn chưa xác thực email nên chưa thể duyệt"}>Duyệt</KinButton>
                    <KinButton variant="danger" onClick={() => { setRejecting(a); setReason(""); }} disabled={busy}>Từ chối</KinButton>
                    {!a.emailVerified && (
                      <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">Cần xác thực email trước khi duyệt.</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <KinConfirm
        open={!!rejecting}
        tone="nguy-hiem"
        title={rejecting ? `Từ chối hồ sơ của ${rejecting.name}` : ""}
        confirmLabel="Từ chối hồ sơ"
        cancelLabel="Hủy"
        loading={!!rejecting && busyId === rejecting.id}
        loadingLabel="Đang gửi…"
        confirmDisabled={!reason.trim()}
        onCancel={() => setRejecting(null)}
        onConfirm={reject}
        message={
          <div className="whitespace-normal">
            <p>Lý do sẽ được gửi cho người nộp đơn. Tài khoản vẫn là học viên bình thường.</p>
            <label htmlFor="reject-reason" className="sr-only">Lý do từ chối</label>
            <textarea id="reject-reason" value={reason} maxLength={REASON_MAX} rows={4}
              onChange={e => setReason(e.target.value)}
              placeholder="Ví dụ: Giới thiệu chưa nêu kinh nghiệm dạy, vui lòng bổ sung."
              className="mt-3 w-full px-3 py-2 text-[length:var(--kin-co-goc)] rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] border border-[var(--kin-vien-o-nhap)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]" />
            <p className="text-[length:var(--kin-co-caption)] text-right mt-1 text-[var(--kin-chu-mo)]">{reason.length}/{REASON_MAX}</p>
          </div>
        }
      />
    </div>
  );
}
