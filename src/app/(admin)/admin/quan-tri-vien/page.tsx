"use client";

import { useState, useEffect, useMemo } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { useAuth, PERMISSIONS } from "@/contexts/AuthContext";

interface UserRow {
  id:        string;
  name:      string;
  email:     string;
  phone:     string | null;
  role:      string;
  adminRole: string | null;
  _count:    { enrollments: number };
}

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  admin_super:    { label: "Super Admin (Cấp 1)",   color: "#FE9900", bg: "#FFF7ED" },
  admin_content:  { label: "Content Admin (Cấp 2)", color: "#0068FF", bg: "#EFF6FF" },
  teacher:        { label: "Giáo viên",             color: "#16a34a", bg: "#F0FDF4" },
  hoc_vien:       { label: "Học viên",              color: "#1D4ED8", bg: "#DBEAFE" },
  chua_kich_hoat: { label: "Chưa KH",               color: "#6B7280", bg: "#F3F4F6" },
};

function RoleBadge({ role, adminRole, enrollments }: {
  role: string; adminRole: string | null; enrollments: number;
}) {
  const key = role === "admin"
    ? (adminRole ?? "admin_content")
    : enrollments > 0 ? "hoc_vien" : "chua_kich_hoat";
  const cfg = ROLE_CFG[key] ?? ROLE_CFG.chua_kich_hoat;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function QuanTriVienPage() {
  const { user: me } = useAuth();
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "admin" | "student" | "chua-kh">("all");
  const [pending, setPending]       = useState<string | null>(null);
  const [confirmRevoke, setConfirm] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/users", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function changeRole(
    id: string,
    role: "admin" | "student",
    adminRole?: "admin_super" | "admin_content" | "teacher" | null
  ) {
    setPending(id);
    try {
      const res  = await fetch(`/api/users/${id}/role`, {
        method:      "PUT",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ role, adminRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Chỉ update role/adminRole — giữ nguyên _count để stats không bị mất
        setUsers(prev => prev.map(u => u.id === id
          ? { ...u, role: data.role, adminRole: data.adminRole ?? null }
          : u
        ));
        showToast("Đã cập nhật quyền thành công");
      } else {
        showToast(data.error ?? "Lỗi cập nhật", false);
      }
    } catch {
      showToast("Lỗi kết nối, thử lại sau", false);
    } finally {
      setPending(null);
    }
  }

  // Một lần pass — tính counts + filtered cùng lúc
  const counts = useMemo(() => {
    let admin = 0, hocVien = 0, chuaKH = 0;
    for (const u of users) {
      if (u.role === "admin") admin++;
      else if (u._count.enrollments > 0) hocVien++;
      else chuaKH++;
    }
    return { admin, hocVien, chuaKH };
  }, [users]);

  const filtered = useMemo(() => users.filter(u => {
    if (filter === "admin"   && u.role !== "admin")   return false;
    if (filter === "student" && !(u.role === "student" && u._count.enrollments > 0)) return false;
    if (filter === "chua-kh" && !(u.role === "student" && u._count.enrollments === 0)) return false;
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)
           && !(u.phone ?? "").toLowerCase().includes(q)) return false;
    return true;
  }), [users, filter, search]);

  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_ADMINS}>
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: toast.ok ? "#16a34a" : "#dc2626" }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0"
        style={{ height: "calc(100vh - 104px)" }}>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-lg font-extrabold" style={{ color: "#1E2938" }}>Quản trị viên</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>Phân quyền và quản lý tài khoản trong hệ thống</p>
        </div>

        {/* Stats compact inline */}
        <div className="px-5 py-2.5 flex items-center gap-5 border-b border-gray-100 flex-shrink-0">
          {loading ? (
            <div className="flex items-center gap-5">
              {[60, 80, 60, 56].map((w, i) => (
                <div key={i} className="h-4 rounded animate-pulse bg-gray-200" style={{ width: w }} />
              ))}
            </div>
          ) : (
            [
              { label: "Tổng",          val: users.length,   color: "#374151" },
              { label: "Quản trị viên", val: counts.admin,   color: "#FE9900" },
              { label: "Học viên",      val: counts.hocVien, color: "#0068FF" },
              { label: "Chưa KH",       val: counts.chuaKH,  color: "#9CA3AF" },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-200 mr-2">|</span>}
                <span className="text-base font-extrabold" style={{ color: s.color }}>{s.val}</span>
                <span className="text-xs text-gray-400">{s.label}</span>
              </div>
            ))
          )}
        </div>

        {/* Filters */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-3 flex-wrap border-b border-gray-100 flex-shrink-0">
          <input type="text" placeholder="Tìm theo tên, email hoặc SĐT..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 w-72" />
          <div className="flex gap-2">
            {(["all", "admin", "student", "chua-kh"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all cursor-pointer"
                style={filter === f
                  ? { background: "linear-gradient(135deg,#0068FF,#0052DD)", color: "white", borderColor: "transparent" }
                  : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}>
                {f === "all"
                  ? `Tất cả (${users.length})`
                  : f === "admin"
                  ? `Quản trị viên (${counts.admin})`
                  : f === "student"
                  ? `Học viên (${counts.hocVien})`
                  : `Chưa KH (${counts.chuaKH})`
                }
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Tên", "Email", "SĐT", "Khoá học", "Vai trò hiện tại", "Hành động"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {[120, 160, 80, 60, 100, 200].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-200" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && fetchError && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-sm font-semibold text-red-500">Không thể tải danh sách người dùng</p>
                    <button
                      onClick={() => {
                        setFetchError(false);
                        setLoading(true);
                        fetch("/api/users", { credentials: "same-origin" })
                          .then(r => r.ok ? r.json() : Promise.reject())
                          .then(d => setUsers(Array.isArray(d) ? d : []))
                          .catch(() => setFetchError(true))
                          .finally(() => setLoading(false));
                      }}
                      className="mt-2 text-xs text-blue-500 hover:underline cursor-pointer">
                      Thử lại
                    </button>
                  </td>
                </tr>
              )}
              {!loading && !fetchError && filtered.map(u => {
                const isMe      = u.id === me?.id;
                const isAdmin   = u.role === "admin";
                const isSuper   = u.adminRole === "admin_super";
                const isTeacher = u.adminRole === "teacher";
                const busy      = pending === u.id;
                const confirming = confirmRevoke === u.id;
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{u.name}</p>
                      {isMe && <span className="text-xs text-blue-500 font-medium">(Bạn)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{u.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin
                        ? <span className="text-sm text-gray-300">—</span>
                        : <span className="text-sm font-bold" style={{ color: "#0068FF" }}>{u._count.enrollments}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} adminRole={u.adminRole} enrollments={u._count.enrollments} />
                    </td>
                    <td className="px-4 py-3">
                      {isMe ? (
                        <span className="text-xs text-gray-400">Không thể tự đổi</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {!isAdmin && (
                            <button onClick={() => changeRole(u.id, "admin", "admin_content")} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer transition-all duration-150 active:scale-[0.97]"
                              style={{ background: "linear-gradient(135deg,#0068FF,#0052DD)" }}>
                              {busy ? "..." : "Thêm Admin Cấp 2"}
                            </button>
                          )}
                          {!isAdmin && (
                            <button onClick={() => changeRole(u.id, "admin", "teacher")} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer transition-all duration-150 active:scale-[0.97]"
                              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                              {busy ? "..." : "Thêm Giáo viên"}
                            </button>
                          )}
                          {isAdmin && isTeacher && (
                            <button onClick={() => changeRole(u.id, "admin", "admin_content")} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer transition-all duration-150 active:scale-[0.97]"
                              style={{ background: "linear-gradient(135deg,#0068FF,#0052DD)" }}>
                              {busy ? "..." : "Nâng lên Content Admin"}
                            </button>
                          )}
                          {isAdmin && !isSuper && !isTeacher && (
                            <button onClick={() => changeRole(u.id, "admin", "admin_super")} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer transition-all duration-150 active:scale-[0.97]"
                              style={{ background: "linear-gradient(135deg,#FE9900,#E07800)" }}>
                              {busy ? "..." : "Nâng lên Cấp 1"}
                            </button>
                          )}
                          {isAdmin && isSuper && (
                            <button onClick={() => changeRole(u.id, "admin", "admin_content")} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-300 disabled:opacity-50 cursor-pointer"
                              style={{ color: "#FE9900", background: "#FFF7ED" }}>
                              {busy ? "..." : "Hạ xuống Cấp 2"}
                            </button>
                          )}
                          {isAdmin && !confirming && (
                            <button onClick={() => setConfirm(u.id)} disabled={busy}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 disabled:opacity-50 cursor-pointer transition-all duration-150 active:scale-[0.97]"
                              style={{ color: "#dc2626", background: "#FEF2F2" }}>
                              Thu hồi quyền
                            </button>
                          )}
                          {isAdmin && confirming && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300"
                              style={{ background: "#FEF2F2" }}>
                              <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>Chắc chắn?</span>
                              <button onClick={() => { changeRole(u.id, "student"); setConfirm(null); }}
                                disabled={busy}
                                className="px-2 py-0.5 rounded text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                                style={{ background: "#dc2626" }}>
                                {busy ? "..." : "Xác nhận"}
                              </button>
                              <button onClick={() => setConfirm(null)}
                                className="px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                                Huỷ
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !fetchError && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    Không tìm thấy người dùng
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-500">Hiển thị {filtered.length}/{users.length} người dùng</p>
        </div>
      </div>
    </PermissionGuard>
  );
}
