// HOME-02 — sửa chữ trang chủ công khai (quyền MANAGE_NEWS: admin_super, admin_content). Gia sư không vào được.
"use client";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import HomeEditor from "@/components/admin/home/HomeEditor";

export default function TrangChuAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_NEWS}>
      <HomeEditor />
    </PermissionGuard>
  );
}
