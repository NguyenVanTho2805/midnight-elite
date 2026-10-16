"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, Role } from "@/contexts/AuthContext";
import { KinLoader } from "@/components/kin/KinLoader";

interface Props {
  requiredRole?: Role;
  children: React.ReactNode;
}

export default function AuthGuard({ requiredRole, children }: Props) {
  const { user, isLoading, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // AuthProvider chỉ hỏi /api/auth/me MỘT lần lúc mở trang. Guard gắn vào SAU lần hỏi đó (chuyển trang kiểu client, không tải cứng) thì câu trả lời "chưa ai đăng nhập"
  // có thể đã cũ: máy chủ có thể vừa tạo phiên (xác thực email tự đăng nhập). Đuổi người đó sang /dang-nhap là đúng lúc proxy thấy cookie hợp lệ và đẩy ngược →
  // trang trắng vĩnh viễn (16/10/2026, xem ui-journey-new-student J3). Nên hỏi lại ĐÚNG MỘT lần trước khi đuổi. Guard gắn khi lần hỏi đầu còn đang chạy (khách mở thẳng
  // trang bảo vệ) thì lần hỏi đó chính là câu trả lời mới nhất — không hỏi thừa.
  const [recheck, setRecheck] = useState<"pending" | "done">(() => (isLoading ? "done" : "pending"));
  const rechecking = useRef(false);

  // Admin được phép vào student routes (để preview nội dung)
  const adminViewingStudent = requiredRole === "student" && user?.role === "admin";
  const allowed = !requiredRole || user?.role === requiredRole || adminViewingStudent;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      if (recheck === "pending") {
        if (!rechecking.current) {
          rechecking.current = true;
          refresh().finally(() => setRecheck("done"));
        }
        return;
      }
      // Đăng nhập xong quay lại đúng trang đang định vào, không đá về trang chủ (Figma 33:2, cột "hết hạn thì sao").
      router.replace(`/dang-nhap?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed) {
      router.replace(user.role === "admin" ? "/admin" : "/student/viec-cua-toi");
    }
  }, [user, isLoading, allowed, router, pathname, recheck, refresh]);

  if (isLoading || (!user && recheck === "pending")) {
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
