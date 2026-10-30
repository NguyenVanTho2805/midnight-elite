// BU-00 bước 3 — liên kết trong các trang DÙNG CHUNG giữa gia sư và quản trị (admin/thi-thu*, admin/khoa-hoc*): gia sư đi đường /lop-cua-toi/…,
// quản trị giữ /admin/…. Hook (cần useAuth) tách khỏi src/lib/tutorRoutes.ts để phần thuần vẫn test được không cần React.
"use client";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { contentHref } from "@/lib/tutorRoutes";

/** `const href = useContentHref(); <Link href={href("/admin/khoa-hoc")}>` — trả đúng đường theo vai người đang xem. */
export function useContentHref(): (adminPath: string) => string {
  const { user } = useAuth();
  const isTeacher = user?.adminRole === "teacher";
  return useCallback((adminPath: string) => contentHref(isTeacher, adminPath), [isTeacher]);
}
