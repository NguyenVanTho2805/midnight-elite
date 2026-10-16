"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, Role } from "@/contexts/AuthContext";
import { KinLoader } from "@/components/kin/KinLoader";

interface Props {
  requiredRole?: Role;
  children: React.ReactNode;
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--kin-nen-bang)" }}>
      <KinLoader size={56} />
    </div>
  );
}

export default function AuthGuard({ requiredRole, children }: Props) {
  const { user, isLoading, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // `user` null chưa chắc là khách: máy chủ có thể vừa tạo phiên SAU lần AuthProvider hỏi /api/auth/me lúc mở trang mà trang không tải cứng
  // (vd xác thực email tự đăng nhập rồi router.push). Đuổi sang đăng nhập lúc đó thì proxy.ts thấy cookie hợp lệ và đẩy ngược về → TRANG TRẮNG.
  // Nên hỏi lại ĐÚNG MỘT lần (mỗi lần gắn khung này); chỉ khi /me vẫn trả "không ai" mới là khách thật.
  const askedRef = useRef(false);
  const [guestConfirmed, setGuestConfirmed] = useState(false);

  // Admin được phép vào student routes (để preview nội dung)
  const adminViewingStudent = requiredRole === "student" && user?.role === "admin";
  const allowed = !requiredRole || user?.role === requiredRole || adminViewingStudent;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      if (!askedRef.current) {
        askedRef.current = true;
        void refresh().then(() => setGuestConfirmed(true));
        return;
      }
      if (!guestConfirmed) return; // đang chờ câu trả lời của lần hỏi lại
      // Đăng nhập xong quay lại đúng trang đang định vào, không đá về trang chủ (Figma 33:2, cột "hết hạn thì sao").
      router.replace(`/dang-nhap?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed) {
      router.replace(user.role === "admin" ? "/admin" : "/student/viec-cua-toi");
    }
  }, [user, isLoading, allowed, router, pathname, refresh, guestConfirmed]);

  if (isLoading) return <Loading />;

  if (!user) return guestConfirmed ? null : <Loading />;
  if (!allowed) return null;

  return <>{children}</>;
}
