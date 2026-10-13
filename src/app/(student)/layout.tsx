"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import AIChatWidget from "@/components/AIChatWidget";
import AuthGuard from "@/components/AuthGuard";
import StudentShell from "@/components/student/StudentShell";
import { useEnrollments } from "@/hooks/useEnrollments";

function StudentChatWidget() {
  const { enrolledIds, loading } = useEnrollments();
  if (loading) return null;
  // Sales Bot đã bỏ (BE-081) — học viên chưa ghi danh lớp nào không có widget chat.
  return enrolledIds.size > 0 ? <AIChatWidget /> : null;
}

// "Việc của tôi" tự dàn hai khung sát mép (danh sách + khung đọc); các trang còn lại giữ lề như trước.
function Content({ children }: { children: React.ReactNode }) {
  const flush = usePathname().startsWith("/student/viec-cua-toi");
  return (
    <main className={flush ? "" : "px-4 md:px-8 py-6 max-w-screen-2xl mx-auto"}>
      <Suspense fallback={
        <div className="animate-pulse space-y-4 p-4 md:p-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl" style={{ background: "var(--kin-vien-thuong)" }} />
          ))}
        </div>
      }>
        <div className="page-enter">{children}</div>
      </Suspense>
    </main>
  );
}

// Vỏ học sinh kiểu Outlook (Figma 11:98): thanh module trái / thanh dưới, dải trên có logo + xu + chuông.
// Phòng thi (/student/thi-thu/<mã đề>) không có vỏ — xem StudentShell.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="student">
      <div data-vung="sang" className="min-h-screen" style={{ background: "var(--kin-nen-trang)" }}>
        <StudentShell>
          <Content>{children}</Content>
        </StudentShell>
        <StudentChatWidget />
      </div>
    </AuthGuard>
  );
}
