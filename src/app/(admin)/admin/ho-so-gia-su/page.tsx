// FE-138 — trang duyệt hồ sơ gia sư. Quản lý trung tâm (admin_super,
// admin_content) mới vào được; gia sư (teacher) không tự duyệt nhau.
"use client";
import { KinCallout } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import TutorApplicationsPanel from "@/components/admin/TutorApplicationsPanel";
import { PERMISSIONS } from "@/contexts/AuthContext";

export default function HoSoGiaSuPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}>
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-[28px] leading-9 font-medium text-[var(--kin-chu-chinh)]">Duyệt hồ sơ gia sư</h1>
          <p className="mt-2 max-w-[68ch] text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
            Xem giới thiệu và môn dạy của người nộp đơn rồi duyệt hoặc từ chối. Duyệt xong người đó đăng nhập lại để bắt đầu tạo lớp.
          </p>
        </div>
        <TutorApplicationsPanel />
        <KinCallout title="Duyệt hồ sơ không phải xác minh chuyên môn">
          Trường học, bằng cấp và chứng chỉ vẫn mang nhãn “Tự khai” sau khi được duyệt. KiN chỉ kiểm nội dung công khai.
        </KinCallout>
      </div>
    </PermissionGuard>
  );
}
