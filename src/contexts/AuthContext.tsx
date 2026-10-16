"use client";

import { landingPath } from "@/lib/landing";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { syncShellHint } from "@/lib/shellHint";
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
  login:     (identifier: string, password: string) => Promise<{ success: boolean; message?: string; code?: string; retryAfterSec?: number }>;
  /** Đăng nhập bằng mã 6 số gửi qua email (TK-170). `code` = wrong | locked | expired | format khi thất bại. */
  loginWithCode: (emailOrPhone: string, code: string) => Promise<{ success: boolean; message?: string; code?: string; attemptsLeft?: number; retryAfterSec?: number }>;
  logout:    () => Promise<void>;
  /** Hỏi lại máy chủ "ai đang đăng nhập" (GET /api/auth/me) rồi cập nhật `user`. Dùng khi máy chủ có thể vừa tạo phiên SAU lần hỏi lúc mở trang mà trang không tải cứng
   *  (vd xác thực email tự đăng nhập). Không bao giờ ném lỗi; lỗi mạng / máy chủ thì giữ nguyên `user`. */
  refresh:   () => Promise<void>;
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router = useRouter();
  // Tăng mỗi khi login / loginWithCode tự đặt `user`: câu trả lời /me gửi đi TRƯỚC lần đặt đó đã cũ, bỏ đi (khỏi ghi đè người vừa đăng nhập bằng "không ai").
  const sessionVersion = useRef(0);

  useEffect(() => {
    fetchMe()
      .then(me => { if (me) setUser(me); })
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    const version = sessionVersion.current;
    const me = await fetchMe();
    if (me !== undefined && version === sessionVersion.current) setUser(me);
    setLoading(false);
  }, []);

  // Nhớ "máy này đang đăng nhập kiểu gì" để lần tải cứng sau không nháy khung khách (src/lib/signedInShell.ts). Chỉ ghi khi đã biết chắc (hết isLoading).
  useEffect(() => {
    if (!isLoading) syncShellHint(user);
  }, [user, isLoading]);

  async function login(identifier: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, message: data.error ?? "Đăng nhập thất bại", code: data.code, retryAfterSec: data.retryAfterSec };
    sessionVersion.current++;
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
    sessionVersion.current++;
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
    <AuthContext.Provider value={{ user, isLoading, login, loginWithCode, logout, refresh }}>
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
/** GET /api/auth/me. `null` = máy chủ nói "không ai đăng nhập"; `undefined` = không biết chắc (lỗi mạng / máy chủ) → bên gọi giữ nguyên `user`. */
async function fetchMe(): Promise<AuthUser | null | undefined> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.id ? toAuthUser(data) : null;
  } catch {
    return undefined;
  }
}

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
