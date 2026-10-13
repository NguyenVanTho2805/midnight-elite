// FE-138 — trang duyệt hồ sơ gia sư. Quản lý trung tâm (admin_super,
// admin_content) mới vào được; gia sư (teacher) không tự duyệt nhau.
"use client";
import PermissionGuard from "@/components/PermissionGuard";
import TutorApplicationsPanel from "@/components/admin/TutorApplicationsPanel";
import { PERMISSIONS } from "@/contexts/AuthContext";

export default function HoSoGiaSuPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Duyệt hồ sơ gia sư</h1>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            Xem giới thiệu và môn dạy của người nộp đơn rồi duyệt hoặc từ chối. Duyệt xong người đó đăng nhập lại để bắt đầu tạo lớp.
          </p>
        </div>
        <TutorApplicationsPanel />
      </div>
    </PermissionGuard>
  );
}
