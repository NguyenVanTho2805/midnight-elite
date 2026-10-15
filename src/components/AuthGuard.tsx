"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, Role } from "@/contexts/AuthContext";
import { KinLoader } from "@/components/kin/KinLoader";

interface Props {
  requiredRole?: Role;
  children: React.ReactNode;
}

export default function AuthGuard({ requiredRole, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Admin được phép vào student routes (để preview nội dung)
  const adminViewingStudent = requiredRole === "student" && user?.role === "admin";
  const allowed = !requiredRole || user?.role === requiredRole || adminViewingStudent;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Đăng nhập xong quay lại đúng trang đang định vào, không đá về trang chủ (Figma 33:2, cột "hết hạn thì sao").
      router.replace(`/dang-nhap?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed) {
      router.replace(user.role === "admin" ? "/admin" : "/student/viec-cua-toi");
    }
  }, [user, isLoading, allowed, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--kin-nen-bang)" }}>
        <KinLoader size={56} />
      </div>
    );
  }

  if (!user) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
