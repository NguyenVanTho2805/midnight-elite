import { NextRequest, NextResponse } from "next/server";

// Tách admin ra domain riêng — admin.midnightelite-edu.com phục vụ đúng cây
// route /admin (đã có sẵn ở src/app/(admin)/admin), domain chính không còn
// cho vào /admin nữa (redirect hẳn sang domain admin). 1 codebase/1 deployment
// duy nhất — chỉ đọc header Host để rewrite/redirect, không cần CORS/API
// riêng vì fetch("/api/...") tương đối vẫn cùng-origin trên cả 2 domain.
const ADMIN_HOST = "admin.midnightelite-edu.com";

function isAdminHost(host: string): boolean {
  return host === ADMIN_HOST || host.startsWith(`${ADMIN_HOST}:`); // cho phép cổng khi giả lập Host cục bộ
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  if (isAdminHost(host)) {
    // API, tài nguyên tĩnh Next, trang đăng nhập dùng chung — giữ nguyên.
    if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.startsWith("/dang-nhap")) {
      return NextResponse.next();
    }
    // "/" → dashboard admin.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }
    // Mọi link nội bộ admin đều đã dùng tiền tố /admin (xem AdminSidebar.tsx)
    // — cho qua nguyên trạng.
    if (pathname.startsWith("/admin")) return NextResponse.next();
    // Đường lạ trên domain admin (vd gõ nhầm /khoa-hoc) — không phục vụ trang
    // công khai qua domain này, bật lại dashboard.
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Domain chính: chặn hẳn đường cũ /admin/..., ép sang domain admin (giữ
  // nguyên sub-path — bookmark/link cũ vẫn tới đúng chỗ, chỉ đổi domain).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = req.nextUrl.clone();
    url.hostname = ADMIN_HOST;
    url.pathname = pathname.replace(/^\/admin/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
