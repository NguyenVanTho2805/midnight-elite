// BU-00 bước 3 (31/10/2026) — nhóm NỘI DUNG của gia sư: /lop-cua-toi/de-thi* (đề thi, ngân hàng câu hỏi, ngân hàng đề) và /lop-cua-toi/quan-lop* (quản lớp,
// học viên, điểm danh). Các trang trong nhóm là trang MỎNG re-export đúng trang gốc ở src/app/(admin)/admin/… (hai tệp lớn chưa tách — để BU-02/BU-03),
// nên cùng một mã chạy trong hai vỏ: quản trị thấy vỏ quản trị ở /admin/…, gia sư thấy vỏ gia sư ở đây (vỏ do (tutor)/layout.tsx → LopCuaToiFrame cấp).
// Layout này chỉ làm hai việc: (1) đúng vai — chỉ gia sư; quản trị về /admin (proxy đưa sang tên miền quản trị), học sinh / khách về /lop-cua-toi;
// (2) dải tab trang con (TutorContentTabs) thay AdminTabStrip, rồi đệm nội dung như TutorAdminFrame cũ (p-4 sm:p-6) để trang gốc không đổi dáng.
// BU-00 bước 5: cổng đi qua src/lib/tutorGateServer.ts — gia sư CHỜ DUYỆT về /lop-cua-toi/cho-duyet thay vì danh sách lớp của học sinh.
import { Suspense, type ReactNode } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import TutorContentTabs from "@/components/tutor/TutorContentTabs";

export default async function TutorContentLayout({ children }: { children: ReactNode }) {
  // Layout máy chủ không biết pathname → khách về /dang-nhap?redirect=/lop-cua-toi như trước (trang gốc /admin/… tự giữ ?redirect= đúng trang khi cần).
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi", adminTo: "/admin" });
  return (
    <>
      <Suspense fallback={null}><TutorContentTabs /></Suspense>
      <main className="p-4 sm:p-6">{children}</main>
    </>
  );
}
