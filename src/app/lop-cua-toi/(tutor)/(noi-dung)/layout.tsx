// BU-00 bước 3 (31/10/2026) — nhóm NỘI DUNG của gia sư: /lop-cua-toi/de-thi* (đề thi, ngân hàng câu hỏi, ngân hàng đề) và /lop-cua-toi/quan-lop* (quản lớp,
// học viên, điểm danh). Các trang trong nhóm là trang MỎNG re-export đúng trang gốc ở src/app/(admin)/admin/… (hai tệp lớn chưa tách — để BU-02/BU-03),
// nên cùng một mã chạy trong hai vỏ: quản trị thấy vỏ quản trị ở /admin/…, gia sư thấy vỏ gia sư ở đây (vỏ do (tutor)/layout.tsx → LopCuaToiFrame cấp).
// Layout này chỉ làm hai việc: (1) đúng vai — chỉ gia sư; quản trị về /admin (proxy đưa sang tên miền quản trị), học sinh / khách về /lop-cua-toi;
// (2) dải tab trang con (TutorContentTabs) thay AdminTabStrip, rồi đệm nội dung như TutorAdminFrame cũ (p-4 sm:p-6) để trang gốc không đổi dáng.
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import TutorContentTabs from "@/components/tutor/TutorContentTabs";

export default async function TutorContentLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session?.role === "admin" && session.adminRole !== "teacher") redirect("/admin");
  if (!session || session.role !== "admin") redirect("/lop-cua-toi");
  return (
    <>
      <Suspense fallback={null}><TutorContentTabs /></Suspense>
      <main className="p-4 sm:p-6">{children}</main>
    </>
  );
}
