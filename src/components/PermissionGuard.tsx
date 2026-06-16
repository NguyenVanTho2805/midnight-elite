"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, hasPermission, type Permission } from "@/contexts/AuthContext";

interface Props {
  required: Permission;
  children: React.ReactNode;
}

/**
 * Bao bọc bất kỳ trang admin nào yêu cầu quyền cụ thể.
 * Nếu user không có quyền → redirect về /admin tức thì.
 */
export default function PermissionGuard({ required, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const allowed = hasPermission(user, required);

  useEffect(() => {
    if (isLoading) return;
    if (user && user.role === "admin" && !allowed) {
      router.replace("/admin");
    }
  }, [user, isLoading, allowed, router]);

  if (isLoading) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
