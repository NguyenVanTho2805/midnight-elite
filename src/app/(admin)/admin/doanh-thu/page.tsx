"use client";

import { useState, useEffect, useMemo } from "react";
import { ChartBar, ClipboardList } from "griddy-icons";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Analytics {
  totalRevenue:     number;
  totalEnrollments: number;
  totalStudents:    number;
  totalCourses:     number;
  byCourse:         { name: string; revenue: number; enrollments: number }[];
  revenueByMonth:   { month: string; revenue: number; enrollments: number }[];
  allEnrollments:   {
    id: string; userName: string; userPhone: string;
    courseName: string; amount: number; createdAt: string;
  }[];
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DoanhThuPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [catFilter, setCatFilter] = useState("");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function loadAnalytics() {
    setLoading(true);
    fetch("/api/admin/analytics", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(d => setAnalytics(d))
      .catch(() => showToast("Lỗi tải dữ liệu doanh thu", false))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAnalytics(); }, []);

  // ── Export CSV ──────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!analytics) return;
    const header = ["Học sinh", "SĐT", "Khoá học", "Số tiền", "Ngày kích hoạt"];
    const rows   = analytics.allEnrollments.map(e => [
      e.userName, e.userPhone, e.courseName,
      e.amount, e.createdAt.slice(0, 10),
    ]);
    const csv  = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`Đã xuất ${analytics.allEnrollments.length} giao dịch`);
  }

  // Filter bảng theo khoá học — options từ byCourse (đủ tất cả khoá)
  const displayEnrollments = useMemo(() =>
    catFilter
      ? analytics?.allEnrollments.filter(e => e.courseName === catFilter) ?? []
      : analytics?.allEnrollments ?? [],
  [analytics, catFilter]);

  const displayTotal = useMemo(() =>
    displayEnrollments.reduce((s, e) => s + e.amount, 0),
  [displayEnrollments]);

  const chartMax = useMemo(() =>
    Math.max(...(analytics?.byCourse ?? []).map(p => p.revenue), 1),
  [analytics]);

  const monthMax = useMemo(() =>
    Math.max(...(analytics?.revenueByMonth ?? []).map(m => m.revenue), 1),
  [analytics]);

  return (
    <PermissionGuard required={PERMISSIONS.VIEW_REVENUE}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="space-y-6 overflow-y-auto" style={{ height: "calc(100vh - 104px)" }}>
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Doanh thu</h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Tính theo kích hoạt khoá học · Mỗi enrollment = 1 giao dịch
            </p>
          </div>
          <button onClick={loadAnalytics}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 active:scale-[0.97]"
            style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA,-4px -4px 8px #ffffff", color: "#0068FF" }}>
            ↺ Tải lại
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Tổng doanh thu",
              value: analytics ? `${(analytics.totalRevenue / 1_000_000).toFixed(1)}Mđ` : "—",
              sub:   `${analytics?.totalEnrollments ?? 0} lượt kích hoạt`,
              color: "#0068FF",
            },
            {
              label: "Học viên đã KH",
              value: String(analytics?.totalStudents ?? "—"),
              sub:   "đã kích hoạt ít nhất 1 khoá",
              color: "#0EA5E9",
            },
            {
              label: "Khoá học",
              value: String(analytics?.totalCourses ?? "—"),
              sub:   "có học viên đăng ký",
              color: "#00A63D",
            },
            {
              label: "TB/khoá",
              value: analytics && analytics.byCourse.length > 0
                ? `${Math.round(analytics.totalRevenue / analytics.byCourse.length / 1_000_000 * 10) / 10}Mđ`
                : "—",
              sub:   "doanh thu trung bình mỗi khoá",
              color: "#FE9900",
            },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-5"
              style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
              <div className="mb-2">
                <div className="text-xs" style={{ color: "#6B7280" }}>{c.label}</div>
              </div>
              <div className="text-2xl font-extrabold mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="text-xs" style={{ color: "#9CA3AF" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Doanh thu theo khoá học */}
        <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
          <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "#1E2938" }}>
            <ChartBar size={18} /> Doanh thu theo khoá học
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
              ))}
            </div>
          ) : (analytics?.byCourse ?? []).length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Chưa có dữ liệu doanh thu</p>
          ) : (
            (analytics?.byCourse ?? []).map(p => (
              <div key={p.name} className="flex items-center gap-4 mb-3">
                <div className="w-44 flex-shrink-0 text-sm truncate" style={{ color: "#1E2938" }}>{p.name}</div>
                <div className="flex-1 h-2 rounded-full"
                  style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff" }}>
                  <div className="h-2 rounded-full"
                    style={{ width: `${(p.revenue / chartMax * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#0068FF,#2680FF)" }} />
                </div>
                <div className="text-right flex-shrink-0 w-32">
                  <div className="text-sm font-bold" style={{ color: "#0068FF" }}>
                    {(p.revenue / 1_000_000).toFixed(1)}Mđ
                  </div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{p.enrollments} học viên</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Doanh thu theo tháng */}
        {(analytics?.revenueByMonth ?? []).length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
            <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "#1E2938" }}>
              <ChartBar size={18} /> Doanh thu theo tháng
            </h2>
            <div className="space-y-3">
              {(analytics?.revenueByMonth ?? []).map(m => (
                <div key={m.month} className="flex items-center gap-4">
                  <div className="w-16 flex-shrink-0 text-xs font-mono" style={{ color: "#6B7280" }}>
                    {m.month.slice(5)}/{m.month.slice(0, 4)}
                  </div>
                  <div className="flex-1 h-2 rounded-full"
                    style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff" }}>
                    <div className="h-2 rounded-full"
                      style={{ width: `${(m.revenue / monthMax * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#00A63D,#16a34a)" }} />
                  </div>
                  <div className="text-right flex-shrink-0 w-28">
                    <div className="text-sm font-bold" style={{ color: "#00A63D" }}>
                      {(m.revenue / 1_000_000).toFixed(1)}Mđ
                    </div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{m.enrollments} kích hoạt</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lịch sử kích hoạt */}
        <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA,-8px -8px 16px #ffffff" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1E2938" }}>
              <ClipboardList size={18} /> Lịch sử kích hoạt khoá học
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter theo khoá */}
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs outline-none"
                style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA,inset -3px -3px 6px #ffffff", border: "none", color: "#1E2938" }}>
                <option value="">Tất cả khoá học</option>
                {(analytics?.byCourse ?? []).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button onClick={exportCSV}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px #ffffff", color: "#0068FF" }}>
                ↓ Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
              ))}
            </div>
          ) : displayEnrollments.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "#9CA3AF" }}>Chưa có giao dịch nào</p>
          ) : (
            <div className="space-y-2">
              {displayEnrollments.map(e => (
                <div key={e.id} className="grid grid-cols-12 items-center px-4 py-3 rounded-xl"
                  style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 5px #C5D0EA,inset -2px -2px 5px #ffffff" }}>
                  <div className="col-span-3">
                    <div className="text-sm font-medium" style={{ color: "#1E2938" }}>{e.userName}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{e.userPhone}</div>
                  </div>
                  <div className="col-span-4 text-xs truncate" style={{ color: "#4B5563" }}>{e.courseName}</div>
                  <div className="col-span-2 text-right font-bold text-sm" style={{ color: "#0068FF" }}>
                    {e.amount.toLocaleString("vi-VN")}đ
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "#d1fae5", color: "#065f46" }}>
                      Đã kích hoạt
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-xs" style={{ color: "#9CA3AF" }}>
                    {e.createdAt.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid #C5D0EA" }}>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Hiển thị {displayEnrollments.length} giao dịch
            </p>
            <p className="text-xs font-semibold" style={{ color: "#0068FF" }}>
              Tổng: {displayTotal.toLocaleString("vi-VN")}đ
            </p>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
