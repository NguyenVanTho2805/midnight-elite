"use client";

import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import AdminShell from "@/components/admin/AdminShell";
import TutorAdminFrame from "@/components/tutor/TutorAdminFrame";
import { useAuth } from "@/contexts/AuthContext";

// Vỏ quản trị kiểu Outlook (Figma 11:287): thanh module + dải tab trang con. Mọi trang quản trị cũ nằm trong vỏ này, quyền giữ nguyên.
// Gia sư (adminRole "teacher") cũng vào các trang /admin/* (đề thi, quản lớp…) nhưng trong vỏ GIA SƯ — không thấy giao diện quản trị (src/lib/hostRouting.ts).
function Frame({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.adminRole === "teacher" ? <TutorAdminFrame>{children}</TutorAdminFrame> : <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="admin">
      <div data-vung="sang">
        <Frame>
          <Suspense fallback={
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: "var(--kin-vien-thuong)" }} />)}
            </div>
          }>
            <div className="page-enter">{children}</div>
          </Suspense>
        </Frame>
      </div>
    </AuthGuard>
  );
}
