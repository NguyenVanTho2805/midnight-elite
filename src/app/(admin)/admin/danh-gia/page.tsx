"use client";

import { useState, useEffect, useCallback } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";

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
          fill={s <= value ? "#FE9900" : "none"} stroke={s <= value ? "#FE9900" : "#D1D5DB"} strokeWidth="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </div>
  );
}

const STATUS_TAB = [
  { key: "pending",  label: "Chờ duyệt",  color: "#FE9900", bg: "rgba(254,153,0,0.12)"  },
  { key: "approved", label: "Đã duyệt",   color: "#16a34a", bg: "rgba(22,163,74,0.12)"  },
  { key: "rejected", label: "Đã từ chối", color: "#DC2626", bg: "rgba(220,38,38,0.12)"  },
  { key: "all",      label: "Tất cả",     color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
];

function DanhGiaContent() {
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
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActing(null);
    load();
  }

  async function del(id: string) {
    if (!confirm("Xóa đánh giá này?")) return;
    setActing(id);
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    setActing(null);
    load();
  }

  const tabInfo = STATUS_TAB.find(t => t.key === tab)!;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: "#1E2938" }}>Đánh giá khóa học</h1>
        <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Duyệt hoặc từ chối đánh giá của học viên</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TAB.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t.key
              ? { background: t.bg, color: t.color, border: `1px solid ${t.color}40` }
              : { background: "#f6f5f4", color: "#6B7280", border: "1px solid #e5e3df" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e3df" }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "#9CA3AF" }}>Đang tải...</div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "#9CA3AF" }}>
            Không có đánh giá nào
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
              <tr>
                {["Học viên", "Khóa học", "Sao", "Nhận xét", "Ngày gửi", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#9CA3AF" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r, i) => {
                const st = STATUS_TAB.find(t => t.key === r.status)!;
                return (
                  <tr key={r.id} style={{ borderBottom: i < reviews.length - 1 ? "1px solid #e5e3df" : "none" }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: "#1E2938" }}>{r.user.name}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{r.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[160px] truncate" style={{ color: "#4B5563" }}>{r.course.name}</td>
                    <td className="px-4 py-3"><StarDisplay value={r.rating} /></td>
                    <td className="px-4 py-3 text-sm max-w-[220px]" style={{ color: "#4B5563" }}>
                      <p className="line-clamp-2">{r.comment}</p>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#9CA3AF" }}>
                      {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: st?.bg ?? "#f6f5f4", color: st?.color ?? "#6B7280" }}>
                        {st?.label ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {r.status !== "approved" && (
                          <button disabled={acting === r.id} onClick={() => act(r.id, "approved")}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                            style={{ background: "#16a34a" }}>
                            Duyệt
                          </button>
                        )}
                        {r.status !== "rejected" && (
                          <button disabled={acting === r.id} onClick={() => act(r.id, "rejected")}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                            style={{ background: "#fee2e2", color: "#DC2626" }}>
                            Từ chối
                          </button>
                        )}
                        <button disabled={acting === r.id} onClick={() => del(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{ background: "#f6f5f4", color: "#9CA3AF" }}>
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
