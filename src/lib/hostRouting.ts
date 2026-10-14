// Quyết định chuyển hướng của src/proxy.ts. THUẦN (không đọc cookie, không đụng NextResponse) để test từng quy tắc; proxy chỉ giải mã phiên rồi thi hành.
//
// Hai tên miền, một codebase: tên miền chính phục vụ khách / học viên / gia sư; admin.midnightelite-edu.com chỉ phục vụ /admin cho quản trị.
// Cookie phiên KHÔNG dùng chung giữa hai tên miền (không đặt `domain`), nên mỗi lần người dùng bị chuyển sang tên miền kia là đăng nhập lại và thấy một giao diện khác.
// 14/10/2026 (Thọ: "đăng nhập vào là chỉ hiện dashboard, không hiện như trang cho guest"):
//   - Gia sư ở LẠI tên miền chính: các trang /admin/* mà gia sư dùng (Bài KT, ngân hàng đề, lớp…) chạy ngay trên tên miền chính, cùng phiên, trong vỏ gia sư.
//   - Học viên / gia sư đã đăng nhập mà mở trang chủ, /dang-ky hoặc /dang-nhap thì đi thẳng vào dashboard (không thấy trang giới thiệu của khách).
//   - Quản trị cấp 1 / cấp nội dung giữ nguyên: /admin trên tên miền riêng.
import { landingPath } from "@/lib/landing";
import { safeRedirect } from "@/lib/safeRedirect";

export const ADMIN_HOST = "admin.midnightelite-edu.com";
export const MAIN_HOST = ADMIN_HOST.replace(/^admin\./, "");

export interface RouteSession { role: string; adminRole?: string | null }
export interface RouteInput { host: string; pathname: string; search: string; session: RouteSession | null }
export type RouteDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; status: 307 | 308; pathname: string; search?: string; host?: "main" | "admin" };

export const isAdminHost = (host: string): boolean => host === ADMIN_HOST || host.startsWith(`${ADMIN_HOST}:`); // cho phép cổng khi giả lập Host cục bộ

const isTeacher = (s: RouteSession | null): boolean => !!s && s.role === "admin" && s.adminRole === "teacher";
const isLearnerOrTeacher = (s: RouteSession | null): boolean => !!s && (s.role === "student" || isTeacher(s));
const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/");
const AUTH_PAGES = ["/dang-nhap", "/dang-ky"];

/** Có cần giải mã phiên để quyết định không? Chỉ vài đường dẫn cần, các đường còn lại (trang khách, API, tệp tĩnh) không tốn gì. */
export function needsSession(host: string, pathname: string): boolean {
  if (isAdminHost(host)) return !(pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/dang-nhap"));
  return pathname === "/" || isAdminPath(pathname) || AUTH_PAGES.includes(pathname);
}

export function decideRoute({ host, pathname, search, session }: RouteInput): RouteDecision {
  if (isAdminHost(host)) {
    // API, tài nguyên tĩnh Next, trang đăng nhập dùng chung — giữ nguyên.
    if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/dang-nhap")) return { kind: "next" };
    // Gia sư không thuộc về tên miền quản trị: đưa về tên miền chính (cùng đường dẫn).
    if (isTeacher(session)) return { kind: "redirect", status: 307, host: "main", pathname, search };
    // "/" → dashboard admin.
    if (pathname === "/") return { kind: "rewrite", pathname: "/admin" };
    // Mọi link nội bộ admin đều đã dùng tiền tố /admin (xem src/lib/adminNav.ts) — cho qua nguyên trạng.
    if (pathname.startsWith("/admin")) return { kind: "next" };
    // Đường lạ trên tên miền admin (vd gõ nhầm /khoa-hoc) — không phục vụ trang công khai qua tên miền này, bật lại dashboard.
    return { kind: "redirect", status: 307, pathname: "/admin" };
  }

  // Tên miền chính.
  if (isAdminPath(pathname)) {
    if (isTeacher(session)) {
      // Gia sư ở lại tên miền chính (trang /admin/* chạy trong vỏ gia sư). Riêng bảng tổng quan quản trị /admin không dành cho gia sư: về Hộp việc.
      return pathname === "/admin" ? { kind: "redirect", status: 307, pathname: "/lop-cua-toi" } : { kind: "next" };
    }
    // Chặn hẳn đường cũ /admin/..., ép sang tên miền admin (giữ nguyên đường dẫn phụ — bookmark/link cũ vẫn tới đúng chỗ, chỉ đổi tên miền).
    return { kind: "redirect", status: 308, host: "admin", pathname: pathname.replace(/^\/admin/, "") || "/", search };
  }

  if (isLearnerOrTeacher(session) && (pathname === "/" || AUTH_PAGES.includes(pathname))) {
    const home = landingPath(session!.role, session!.adminRole);
    if (pathname === "/dang-nhap") return { kind: "redirect", status: 307, pathname: safeRedirect(new URLSearchParams(search).get("redirect")) ?? home };
    return { kind: "redirect", status: 307, pathname: home };
  }

  return { kind: "next" };
}
