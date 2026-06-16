"use client";

import { Suspense } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import AuthGuard from "@/components/AuthGuard";
import { useAuth, getAdminRoleLabel } from "@/contexts/AuthContext";

function AdminTopbar() {
  const { user } = useAuth();
  const isSuper = user?.adminRole === "admin_super";
  return (
    <header className="clay-header h-14 flex items-center justify-between px-6 flex-shrink-0"
      style={{ boxShadow: "0 2px 8px rgba(197,208,234,0.5)" }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00A63D" }} />
        <span className="text-xs font-medium" style={{ color: "#6B7280" }}>Hệ thống hoạt động bình thường</span>
      </div>
      <div className="flex items-center gap-3">
        {/* Quick preview links */}
        <div className="hidden md:flex items-center gap-1.5">
          <Link href="/student" target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px #ffffff", color: "#0068FF" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            Portal học viên
          </Link>
          <Link href="/khoa-hoc" target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px #ffffff", color: "#6B7280" }}>
            🛒 Khóa học
          </Link>
        </div>
        {/* Admin level badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{
            background: isSuper ? "rgba(254,153,0,0.12)" : "rgba(96,165,250,0.12)",
            color: isSuper ? "#FE9900" : "#60A5FA",
            border: `1px solid ${isSuper ? "#FE990040" : "#60A5FA40"}`,
          }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSuper ? "#FE9900" : "#60A5FA" }} />
          {getAdminRoleLabel(user?.adminRole)}
        </span>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA, -3px -3px 6px #ffffff" }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(145deg, #0055D4, #0042AA)" }}>
            {user?.avatar ?? "A"}
          </div>
          <span className="text-xs font-semibold" style={{ color: "#1E2938" }}>{user?.name ?? "Admin"}</span>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="admin">
      <div className="flex min-h-screen" style={{ background: "#F0F5FF" }}>
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar />
          <main className="flex-1 p-6 overflow-auto">
            <Suspense fallback={<div className="animate-pulse space-y-4">{[1,2,3].map(i=><div key={i} className="h-20 rounded-2xl" style={{background:"#C5D0EA"}}/>)}</div>}>
              <div className="page-enter">{children}</div>
            </Suspense>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
