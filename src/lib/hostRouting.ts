// Quyết định chuyển hướng của src/proxy.ts. THUẦN (không đọc cookie, không đụng NextResponse) để test từng quy tắc; proxy chỉ giải mã phiên rồi thi hành.
//
// Hai tên miền, một codebase: tên miền chính phục vụ khách / học viên / gia sư; admin.midnightelite-edu.com chỉ phục vụ /admin cho quản trị.
// Cookie phiên KHÔNG dùng chung giữa hai tên miền (không đặt `domain`), nên mỗi lần người dùng bị chuyển sang tên miền kia là đăng nhập lại và thấy một giao diện khác.
// 14/10/2026 (Thọ: "đăng nhập vào là chỉ hiện dashboard, không hiện như trang cho guest"):
//   - Gia sư ở LẠI tên miền chính: các trang /admin/* mà gia sư dùng (Bài KT, ngân hàng đề, lớp…) chạy ngay trên tên miền chính, cùng phiên, trong vỏ gia sư.
//   - Học viên / gia sư đã đăng nhập mà mở trang chủ, /dang-ky hoặc /dang-nhap thì đi thẳng vào dashboard (không thấy trang giới thiệu của khách).
//   - Quản trị cấp 1 / cấp nội dung giữ nguyên: /admin trên tên miền riêng.
// 15/10/2026 (Thọ mở admin.midnightelite-edu.com/dang-nhap: mọi nút công khai quay lại chính trang đăng nhập):
//   - Tên miền admin không phục vụ trang nào ngoài /admin, nhưng nhiều nút / liên kết trong thư vẫn trỏ tới đường công khai (/khoa-hoc, /quen-mat-khau, /dang-ky…).
//     Trước đây các đường đó bị đẩy về /admin rồi về lại đăng nhập (quay vòng); nay chuyển sang TÊN MIỀN CHÍNH, giữ đường dẫn và tham số.
//   - Từ tên miền chính sang admin GIỮ NGUYÊN đường dẫn (/admin/kiem-duyet → admin…/admin/kiem-duyet). Trước đây bỏ tiền tố /admin nên đích
//     (admin…/kiem-duyet) lại bị đẩy về dashboard: liên kết / bookmark cũ không bao giờ tới đúng trang.
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
/** Tệp tĩnh trong /public (/plyr.svg, /og-kin.png, /robots.txt…): luôn phục vụ nguyên trạng ở cả hai tên miền. */
const isStaticFile = (p: string) => /\.[a-z0-9]{2,5}$/i.test(p);

/** Có cần giải mã phiên để quyết định không? Chỉ vài đường dẫn cần, các đường còn lại (trang khách, API, tệp tĩnh) không tốn gì. */
export function needsSession(host: string, pathname: string): boolean {
  if (isAdminHost(host)) return !(pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/dang-nhap") || isStaticFile(pathname));
  return pathname === "/" || isAdminPath(pathname) || AUTH_PAGES.includes(pathname);
}

export function decideRoute({ host, pathname, search, session }: RouteInput): RouteDecision {
  if (isAdminHost(host)) {
    // API, tài nguyên tĩnh Next, tệp trong /public, trang đăng nhập dùng chung — giữ nguyên.
    if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/dang-nhap") || isStaticFile(pathname)) return { kind: "next" };
    // Gia sư không thuộc về tên miền quản trị: đưa về tên miền chính (cùng đường dẫn).
    if (isTeacher(session)) return { kind: "redirect", status: 307, host: "main", pathname, search };
    // "/" → dashboard admin.
    if (pathname === "/") return { kind: "rewrite", pathname: "/admin" };
    // Mọi link nội bộ admin đều đã dùng tiền tố /admin (xem src/lib/adminNav.ts) — cho qua nguyên trạng.
    if (isAdminPath(pathname)) return { kind: "next" };
    // Mọi đường còn lại là trang công khai / học viên / gia sư (/khoa-hoc, /quen-mat-khau, /dang-ky, liên kết trong thư…): tên miền admin không phục vụ chúng,
    // nhưng người bấm nút chắc chắn muốn tới ĐÓ — đưa sang tên miền chính, đúng đường dẫn + tham số (không đẩy về dashboard rồi về đăng nhập như trước).
    return { kind: "redirect", status: 307, host: "main", pathname, search };
  }

  // Tên miền chính.
  if (isAdminPath(pathname)) {
    if (isTeacher(session)) {
      // Gia sư ở lại tên miền chính (trang /admin/* chạy trong vỏ gia sư). Riêng bảng tổng quan quản trị /admin không dành cho gia sư: về Hộp việc.
      return pathname === "/admin" ? { kind: "redirect", status: 307, pathname: "/lop-cua-toi" } : { kind: "next" };
    }
    // Chặn hẳn đường cũ /admin/..., ép sang tên miền admin. GIỮ NGUYÊN toàn bộ đường dẫn (kể cả /admin) — tên miền admin chỉ phục vụ /admin/*, nên bỏ tiền tố
    // sẽ rơi vào nhánh "đường lạ" và liên kết / bookmark cũ không bao giờ tới đúng trang.
    return { kind: "redirect", status: 308, host: "admin", pathname, search };
  }

  if (isLearnerOrTeacher(session) && (pathname === "/" || AUTH_PAGES.includes(pathname))) {
    const home = landingPath(session!.role, session!.adminRole);
    if (pathname === "/dang-nhap") return { kind: "redirect", status: 307, pathname: safeRedirect(new URLSearchParams(search).get("redirect")) ?? home };
    return { kind: "redirect", status: 307, pathname: home };
  }

  return { kind: "next" };
}


/** Tên miền nào nhận đăng nhập của vai nào. Tên miền admin chỉ dành cho quản trị cấp 1 / cấp nội dung (gia sư và học viên ở tên miền chính — cookie phiên không dùng chung,
 *  nên đăng nhập nhầm cửa chỉ để lại một phiên vô dụng rồi bị đẩy qua lại / ra trang trắng). Tên miền chính nhận mọi vai (quản trị vào xem thử trang học viên). */
export function hostAcceptsLogin(host: string, role: string, adminRole?: string | null): boolean {
  if (!isAdminHost(host)) return true;
  return role === "admin" && (adminRole === "admin_super" || adminRole === "admin_content");
}

/** Địa chỉ trang đăng nhập của tên miền chính, suy từ tên miền admin đang dùng (giữ cổng khi chạy thử cục bộ). */
export function mainLoginUrl(adminHostHeader: string, protocol: string): string {
  const mainHost = adminHostHeader.replace(/^admin\./, "");
  return `${protocol}//${mainHost}/dang-nhap`;
}
