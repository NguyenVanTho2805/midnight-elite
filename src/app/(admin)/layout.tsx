"use client";

import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import AdminShell from "@/components/admin/AdminShell";

// Vỏ quản trị kiểu Outlook (Figma 11:287): thanh module + dải tab trang con. Mọi trang quản trị cũ nằm trong vỏ này, quyền giữ nguyên.
// BU-00 bước 3 (31/10/2026): gia sư (adminRole "teacher") KHÔNG còn tới đây — proxy 307 /admin/thi-thu*, /admin/khoa-hoc* sang bí danh /lop-cua-toi/de-thi*,
// /lop-cua-toi/quan-lop* (src/lib/hostRouting.ts, src/lib/tutorRoutes.ts), nên không còn nhánh TutorAdminFrame. AuthGuard giữ requiredRole="admin".
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="admin">
      <AdminShell>
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: "var(--kin-vien-thuong)" }} />)}
          </div>
        }>
          <div className="page-enter">{children}</div>
        </Suspense>
      </AdminShell>
    </AuthGuard>
  );
}
