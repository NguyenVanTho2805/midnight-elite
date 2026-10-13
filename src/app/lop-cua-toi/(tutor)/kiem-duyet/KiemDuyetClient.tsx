"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton, KinConfirm } from "@/components/kin";
import { CARD_STYLE, callApi, useNotify } from "@/components/tutor/shared";

interface Report {
  id: string; reason: string; createdAt: string;
  reporter: { id: string; name: string };
  thread: { id: string; content: string; author: { id: string; name: string }; course: { id: string; name: string } | null };
}

export default function KiemDuyetClient() {
  const notify = useNotify();
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Report | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Report[]>("/api/admin/thread-reports");
    if (my !== seq.current) return;
    if (!r.ok || !Array.isArray(r.data)) setFailed(true); else setItems(r.data as Report[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(rep: Report, decision: "approved" | "rejected") {
    setBusy(rep.id);
    const r = await callApi<{ error?: string }>(`/api/admin/thread-reports/${rep.id}/resolve`, { method: "POST", body: JSON.stringify({ decision }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Xử lý thất bại"); await load(); return; }
    notify.ok(decision === "approved" ? "Đã xoá bài viết vi phạm." : "Đã bỏ qua báo cáo.");
    setConfirm(null);
    await load();
  }

  if (loading) return <div className="space-y-2" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>;
  if (failed) return <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>Không tải được báo cáo. <button className="underline font-semibold" onClick={load}>Thử lại</button></div>;
  if (items.length === 0) return <div role="status" className="rounded-xl p-8 text-center text-sm" style={{ ...CARD_STYLE, borderStyle: "dashed", color: "var(--kin-chu-phu)" }}>Không có báo cáo nào cần xử lý.</div>;

  return (
    <>
      <ul className="space-y-3">
        {items.map(r => (
          <li key={r.id} className="rounded-xl p-4" style={CARD_STYLE}>
            <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Lớp {r.thread.course?.name ?? "—"} · {new Date(r.createdAt).toLocaleString("vi-VN")}</p>
            <p className="mt-2 text-sm whitespace-pre-wrap break-words rounded-lg p-3" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-chinh)" }}>
              {r.thread.content.length > 400 ? `${r.thread.content.slice(0, 400)}…` : r.thread.content}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tác giả: <b>{r.thread.author.name}</b> · Báo cáo bởi <b>{r.reporter.name}</b></p>
            <p className="mt-1 text-sm" style={{ color: "var(--kin-chu-chinh)" }}>Lý do: {r.reason}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <KinButton variant="danger" onClick={() => setConfirm(r)} loading={busy === r.id}>Xoá bài vi phạm</KinButton>
              <KinButton variant="secondary" onClick={() => decide(r, "rejected")} loading={busy === r.id}>Bỏ qua</KinButton>
            </div>
          </li>
        ))}
      </ul>
      <KinConfirm
        open={!!confirm}
        tone="nguy-hiem"
        title="Xoá bài viết này?"
        message="Bài viết sẽ bị ẩn khỏi cộng đồng lớp (hệ thống giữ lại bản lưu làm bằng chứng nếu có tranh chấp)."
        cancelLabel="Đóng"
        confirmLabel="Xoá bài"
        loading={!!confirm && busy === confirm.id}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) return decide(confirm, "approved"); }}
      />
    </>
  );
}
