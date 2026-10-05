// FE-128 — admin duyệt yêu cầu nạp Coin. Chỉ admin_super/admin_content
// (MANAGE_REVENUE) truy cập được — gia sư KHÔNG, vì gia sư cũng là user
// nạp, duyệt chính mình gây xung đột.
"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui";

interface Row {
  id: string; amountVnd: number; coinAmount: number; status: string;
  bankRef: string | null; note: string | null; rejectReason: string | null;
  createdAt: string; reviewedAt: string | null;
  user: { id: string; name: string; email: string; adminRole: string | null };
}

export default function AdminTopupsPage() {
  const toast = useToast();
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const url = `/api/admin/topups${status !== "all" ? `?status=${status}` : ""}`;
      const r = await fetch(url, { credentials: "same-origin" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRows(d.items ?? []);
    } catch {
      toast.err("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/topups/${id}/approve`, { method: "POST", credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { toast.err(d.error ?? "Duyệt thất bại"); return; }
      toast.ok(`Đã cộng ${d.coinAmount.toLocaleString("vi-VN")} Coin cho user.`);
      await load();
    } finally { setBusyId(null); }
  }

  async function reject(id: string, reason: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/topups/${id}/reject`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ reason }),
      });
      const d = await r.json();
      if (!r.ok) { toast.err(d.error ?? "Từ chối thất bại"); return; }
      toast.ok("Đã từ chối yêu cầu.");
      setRejectId(null); setRejectReason("");
      await load();
    } finally { setBusyId(null); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Yêu cầu nạp Coin</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          Đối chiếu với sao kê ngân hàng rồi duyệt / từ chối. Admin_super và
          admin_content thấy được, gia sư không.
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={status === s
              ? { background: "#0068FF", color: "#fff" }
              : { background: "#f6f5f4", color: "#374151", border: "1px solid #e5e3df" }}>
            {s === "pending" ? "Đang chờ" : s === "approved" ? "Đã duyệt" : s === "rejected" ? "Đã từ chối" : "Tất cả"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        {loading ? (
          <p className="p-8 text-center text-sm" style={{ color: "#9CA3AF" }}>Đang tải...</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: "#9CA3AF" }}>Không có yêu cầu nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>User</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>VND / Coin</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>Bank ref</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>Thời điểm</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: "#6B7280" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t" style={{ borderColor: "#f3f4f6" }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "#1E2938" }}>{r.user.name}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      {r.user.email}
                      {r.user.adminRole === "teacher" && <> · <span style={{ color: "#b45309" }}>Gia sư</span></>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold" style={{ color: "#1E2938" }}>{r.amountVnd.toLocaleString("vi-VN")} VND</p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>{r.coinAmount.toLocaleString("vi-VN")} Coin</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs" style={{ color: "#1E2938" }}>{r.bankRef ?? "—"}</p>
                    {r.note && <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{r.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#6B7280" }}>
                    {new Date(r.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => approve(r.id)} disabled={busyId === r.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: "#16a34a" }}>Duyệt</button>
                        <button onClick={() => { setRejectId(r.id); setRejectReason(""); }} disabled={busyId === r.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: "#dc2626" }}>Từ chối</button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold"
                        style={{ color: r.status === "approved" ? "#16a34a" : "#dc2626" }}>
                        {r.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2" style={{ color: "#1E2938" }}>Lý do từ chối</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="VD: Không tìm thấy giao dịch trong sao kê"
              className="w-full px-4 py-2.5 rounded-xl text-sm"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }} />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => setRejectId(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Huỷ
              </button>
              <button onClick={() => reject(rejectId, rejectReason)}
                disabled={!rejectReason.trim() || busyId === rejectId}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
