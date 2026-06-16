"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, Role } from "@/contexts/AuthContext";

interface Props {
  requiredRole?: Role;
  children: React.ReactNode;
}

export default function AuthGuard({ requiredRole, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Admin được phép vào student routes (để preview nội dung)
  const adminViewingStudent = requiredRole === "student" && user?.role === "admin";
  const allowed = !requiredRole || user?.role === requiredRole || adminViewingStudent;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/dang-nhap");
      return;
    }
    if (!allowed) {
      router.replace(user.role === "admin" ? "/admin" : "/student");
    }
  }, [user, isLoading, allowed, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F0F5FF" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0068FF, #2680FF)" }}>
            <span className="text-xl font-black text-white">T</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0068FF", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
