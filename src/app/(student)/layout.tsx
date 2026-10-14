"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import StudentShell, { isExamRoom } from "@/components/student/StudentShell";

// Bong bóng "KiN AI" đã GỠ khỏi giao diện học sinh (14/10/2026): nó không nối với AI nào, chỉ chờ 2 giây rồi trả một trong năm
// đoạn chữ viết sẵn (kể cả câu "đã đối chiếu 47 đề thi") — học sinh tưởng đang hỏi AI thật. Gắn lại khi đã nối AI thật; xem AIChatWidget.tsx.

// "Việc của tôi" tự dàn hai khung sát mép (danh sách + khung đọc); phòng thi tự dàn toàn màn hình (thanh Navy + thân cuộn + chân trang,
// Figma 27:2) nên cũng không có lề; các trang còn lại giữ lề như trước.
function Content({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const flush = pathname.startsWith("/student/viec-cua-toi") || isExamRoom(pathname);
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
      </div>
    </AuthGuard>
  );
}
