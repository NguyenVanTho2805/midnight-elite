"use client";

import { useState, useEffect, useCallback } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { useKinConfirm } from "@/components/kin/useConfirm";

interface Review {
  id: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string };
  course: { name: string };
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="14" height="14" viewBox="0 0 24 24"
          fill={s <= value ? "var(--kin-tt-chu-cho)" : "none"} stroke={s <= value ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-mo)"} strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </div>
  );
}

const STATUS_TAB = [
  { key: "pending",  label: "Chờ duyệt",  color: "var(--kin-tt-chu-cho)", bg: "color-mix(in srgb, var(--kin-tt-cham-cho) 12%, transparent)"  },
  { key: "approved", label: "Đã duyệt",   color: "var(--kin-tt-chu-xong)", bg: "color-mix(in srgb, var(--kin-tt-chu-xong) 12%, transparent)"  },
  { key: "rejected", label: "Đã từ chối", color: "var(--kin-tt-chu-loi)", bg: "color-mix(in srgb, var(--kin-tt-chu-loi) 12%, transparent)"  },
  { key: "all",      label: "Tất cả",     color: "var(--kin-chu-mo)", bg: "color-mix(in srgb, var(--kin-chu-mo) 10%, transparent)" },
];

function DanhGiaContent() {
  const { toast, showToast } = useAdminToast();
  const { ask, dialog } = useKinConfirm();
  const [tab, setTab] = useState("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/reviews?status=${tab}`)
      .then(r => r.json())
      .then(d => { setReviews(d.reviews ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, status: "approved" | "rejected") {
    setActing(id);
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActing(null);
    showToast(res.ok ? (status === "approved" ? "Đã duyệt đánh giá" : "Đã từ chối đánh giá") : "Lỗi cập nhật", res.ok);
    load();
  }

  async function del(id: string) {
    if (!(await ask({ title: "Xóa đánh giá này?", message: "Việc này không hoàn tác được." }))) return;
    setActing(id);
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    setActing(null);
    showToast(res.ok ? "Đã xóa đánh giá" : "Lỗi xóa", res.ok);
    load();
  }

  const tabInfo = STATUS_TAB.find(t => t.key === tab)!;

  return (
    <div>
      {dialog}
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Đánh giá khóa học</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Duyệt hoặc từ chối đánh giá của học viên</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TAB.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.key
              ? { background: t.bg, color: t.color, border: `1px solid color-mix(in srgb, ${t.color} 25%, transparent)` }
              : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)", border: "1px solid var(--kin-vien-thuong)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="p-4 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <div className="flex gap-3">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-32 rounded bg-gray-200" />
                </div>
                <div className="h-3 w-3/4 rounded bg-gray-200 mt-3" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-mo)" }}>
            Không có đánh giá nào
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "var(--kin-nen-bang)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
              <tr>
                {["Học viên", "Khóa học", "Sao", "Nhận xét", "Ngày gửi", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r, i) => {
                const st = STATUS_TAB.find(t => t.key === r.status)!;
                return (
                  <tr key={r.id} style={{ borderBottom: i < reviews.length - 1 ? "1px solid var(--kin-vien-thuong)" : "none" }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{r.user.name}</p>
                      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{r.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[160px] truncate" style={{ color: "var(--kin-chu-phu)" }}>{r.course.name}</td>
                    <td className="px-4 py-3"><StarDisplay value={r.rating} /></td>
                    <td className="px-4 py-3 text-sm max-w-[220px]" style={{ color: "var(--kin-chu-phu)" }}>
                      <p className="line-clamp-2">{r.comment}</p>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--kin-chu-mo)" }}>
                      {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: st?.bg ?? "var(--kin-nen-bang)", color: st?.color ?? "var(--kin-chu-mo)" }}>
                        {st?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {r.status !== "approved" && (
                          <button disabled={acting === r.id} onClick={() => act(r.id, "approved")}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                            style={{ background: "var(--kin-nhan-nen)" }}>
                            Duyệt
                          </button>
                        )}
                        {r.status !== "rejected" && (
                          <button disabled={acting === r.id} onClick={() => act(r.id, "rejected")}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
                            Từ chối
                          </button>
                        )}
                        <button disabled={acting === r.id} onClick={() => del(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function DanhGiaPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_COURSES}>
      <DanhGiaContent />
    </PermissionGuard>
  );
}
