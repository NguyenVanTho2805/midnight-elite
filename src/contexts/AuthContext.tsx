"use client";

import { landingPath } from "@/lib/landing";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS, ROLE_PERMISSIONS, checkPermission, type Permission, type AdminRole } from "@/lib/permissions";

// Re-export for consumers that import from AuthContext
export { PERMISSIONS, ROLE_PERMISSIONS };
export type { Permission, AdminRole };

// ─── ROLES & PERMISSIONS ──────────────────────────────────────────────────────
export type Role = "student" | "admin" | null;

export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user || user.role !== "admin") return false;
  return checkPermission(user.adminRole, permission);
}

export function getAdminRoleLabel(adminRole?: AdminRole): string {
  if (adminRole === "admin_super")   return "Super Admin";
  if (adminRole === "admin_content") return "Content Admin";
  if (adminRole === "teacher")       return "Giáo viên";
  return "Admin";
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:            string;
  name:          string;
  email:         string;
  role:          Role;
  avatar:        string;
  studentId?:    number | null;
  phone?:        string | null;
  parentPhone?:  string | null;
  parentName?:   string | null;
  school?:       string | null;
  highSchool?:   string | null;
  city?:         string | null;
  facebookUrl?:  string | null;
  zaloPhone?:    string | null;
  adminRole?:    AdminRole;
  emailVerified: boolean;
}

interface AuthContextType {
  user:      AuthUser | null;
  isLoading: boolean;
  /** Đăng nhập bằng tài khoản + mật khẩu. `identifier` là email hoặc số di động đã xác minh. `code` = "wait" khi bị chặn tạm vì sai nhiều lần. */
  login:     (identifier: string, password: string) => Promise<{ success: boolean; message?: string; code?: string }>;
  /** Đăng nhập bằng mã 6 số gửi qua email (TK-170). `code` = wrong | locked | expired | format khi thất bại. */
  loginWithCode: (emailOrPhone: string, code: string) => Promise<{ success: boolean; message?: string; code?: string; attemptsLeft?: number; retryAfterSec?: number }>;
  logout:    () => Promise<void>;
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data?.id) setUser(toAuthUser(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, message: data.error ?? "Đăng nhập thất bại", code: data.code };
    setUser(toAuthUser(data));
    router.push(landingPath(data.role, data.adminRole));
    return { success: true };
  }

  // Có '@' → email; không có → số điện thoại (máy chủ chuẩn hoá và kiểm).
  async function loginWithCode(emailOrPhone: string, code: string) {
    const res = await fetch("/api/auth/code/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(emailOrPhone.includes("@") ? { email: emailOrPhone, code } : { phone: emailOrPhone, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, message: data.error ?? "Đăng nhập thất bại", code: data.code, attemptsLeft: data.attemptsLeft, retryAfterSec: data.retryAfterSec };
    }
    setUser(toAuthUser(data));
    router.push(landingPath(data.role, data.adminRole));
    return { success: true };
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}

// ─── HELPER ──────────────────────────────────────────────────────────────────
function toAuthUser(data: Record<string, unknown>): AuthUser {
  return {
    id:            String(data.id),
    name:          String(data.name),
    email:         String(data.email),
    role:          (data.role as Role) ?? "student",
    avatar:        String(data.name ?? "?")[0].toUpperCase(),
    studentId:     data.studentId as number | null,
    phone:         data.phone as string | null,
    parentPhone:   data.parentPhone as string | null,
    parentName:    data.parentName as string | null,
    school:        data.school as string | null,
    highSchool:    data.highSchool as string | null,
    city:          data.city as string | null,
    facebookUrl:   data.facebookUrl as string | null,
    zaloPhone:     data.zaloPhone as string | null,
    adminRole:     data.adminRole as AdminRole | undefined,
    emailVerified: Boolean(data.emailVerified),
  };
}
