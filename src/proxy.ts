import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { ADMIN_HOST, MAIN_HOST, decideRoute, needsSession, type RouteSession } from "@/lib/hostRouting";

// Tách admin ra domain riêng — admin.midnightelite-edu.com phục vụ đúng cây
// route /admin (đã có sẵn ở src/app/(admin)/admin), domain chính không còn
// cho vào /admin nữa (redirect hẳn sang domain admin) — TRỪ gia sư: gia sư ở lại domain chính
// để cùng một phiên, cùng một vỏ (xem src/lib/hostRouting.ts, nơi có toàn bộ quy tắc và test).
// 1 codebase/1 deployment duy nhất — chỉ đọc header Host để rewrite/redirect, không cần CORS/API
// riêng vì fetch("/api/...") tương đối vẫn cùng-origin trên cả 2 domain.
const COOKIE_NAME = "midnight_session"; // giữ đúng tên ở src/lib/session.ts

async function sessionOf(req: NextRequest): Promise<RouteSession | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? await decrypt(token) : null;
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const { pathname, search } = req.nextUrl;

  const session = needsSession(host, pathname) ? await sessionOf(req) : null;
  const d = decideRoute({ host, pathname, search, session });

  if (d.kind === "next") return NextResponse.next();
  const url = req.nextUrl.clone();
  if (d.kind === "rewrite") { url.pathname = d.pathname; return NextResponse.rewrite(url); }

  url.pathname = d.pathname;
  url.search = d.search ?? "";
  if (d.host === "admin") url.hostname = ADMIN_HOST;
  else if (d.host === "main") url.hostname = MAIN_HOST;
  const res = NextResponse.redirect(url, d.status);
  // Đích phụ thuộc phiên (gia sư ở lại tên miền chính, người khác bị đẩy sang admin) nên không được để trình duyệt / CDN nhớ chuyển hướng — xem hostRouting.ts (16/10/2026).
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
