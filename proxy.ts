import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token   = req.cookies.get("tsix_session")?.value;
  const session = token ? await decrypt(token) : null;

  // /student/* — yêu cầu đăng nhập
  if (pathname.startsWith("/student")) {
    if (!session) {
      return NextResponse.redirect(new URL("/dang-nhap", req.url));
    }
  }

  // /admin/* — yêu cầu role admin
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/dang-nhap", req.url));
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/student", req.url));
    }
  }

  // Nếu đã đăng nhập mà vào /dang-nhap hoặc /dang-ky → redirect về dashboard
  if (pathname === "/dang-nhap" || pathname === "/dang-ky") {
    if (session) {
      const dest = session.role === "admin" ? "/admin" : "/student";
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/admin/:path*", "/dang-nhap", "/dang-ky"],
};
