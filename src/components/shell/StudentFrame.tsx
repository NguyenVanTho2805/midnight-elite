// Vỏ học sinh cho các trang nằm NGOÀI /student/* mà học sinh vẫn vào được: /lop-cua-toi và /lop-cua-toi/[lớp] (16/10/2026). Trước đây hai trang này không có vỏ nào:
// học sinh (hoặc quản trị xem thử) mở ra chỉ thấy một trang trần, không thanh module, không dải trên — không còn đường đi đâu ngoài nút Back của trình duyệt.
// Cùng khung với src/app/(student)/layout.tsx (thanh module trái / dưới + dải trên có chuông, tài khoản), không bọc AuthGuard vì các trang tự kiểm quyền ở máy chủ.
"use client";
import type { ReactNode } from "react";
import StudentShell from "@/components/student/StudentShell";

// `preview` (BU-00 bước 4): quản trị cấp 1 / nội dung xem thử — StudentShell hiện băng "Đang xem thử giao diện học sinh · Về bảng quản trị".
export default function StudentFrame({ children, preview }: { children: ReactNode; preview?: boolean }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--kin-nen-trang)" }}>
      <StudentShell preview={preview}>
        <main className="px-4 md:px-8 py-6 max-w-screen-2xl mx-auto">
          <div className="page-enter">{children}</div>
        </main>
      </StudentShell>
    </div>
  );
}
