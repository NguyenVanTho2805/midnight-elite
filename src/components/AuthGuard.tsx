"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, Role } from "@/contexts/AuthContext";
import { KinLoader } from "@/components/kin/KinLoader";
import { studentAreaRedirect } from "@/lib/tutorGate";

interface Props {
  requiredRole?: Role;
  children: React.ReactNode;
}

// BU-00 bước 4 (31/10/2026): ai vào được nhóm trang nào quyết ở src/lib/tutorGate.ts (studentAreaRedirect, thuần, có test). Trước đây MỌI role admin — kể cả
// gia sư — đều vào được /student/* ("quản trị xem thử"); nay chỉ quản trị cấp 1 / cấp nội dung xem thử (StudentShell hiện băng "Đang xem thử"), gia sư về
// Hộp việc, gia sư chờ duyệt (cờ `tutorPending` của /api/auth/me) về trang chờ duyệt. Trang dùng chung ngoài /student/* (/cai-dat/chu-de) vẫn mở cho cả hai.
export default function AuthGuard({ requiredRole, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const bounce = user ? studentAreaRedirect(user, requiredRole ?? null, pathname) : null;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Đăng nhập xong quay lại đúng trang đang định vào, không đá về trang chủ (Figma 33:2, cột "hết hạn thì sao").
      router.replace(`/dang-nhap?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (bounce) router.replace(bounce);
  }, [user, isLoading, bounce, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--kin-nen-bang)" }}>
        <KinLoader size={56} />
      </div>
    );
  }

  if (!user) return null;
  if (bounce) return null;

  return <>{children}</>;
}
