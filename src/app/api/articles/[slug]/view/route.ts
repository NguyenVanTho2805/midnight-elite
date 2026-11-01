import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPlausibleSlug, publicArticleWhere } from "@/lib/articlesPublic";
import { shouldCountView, VIEW_COOKIE, VIEW_COOKIE_MAX_AGE_S } from "@/lib/articleViews";
// BU-07 mục 4.3: tăng lượt xem ẩn danh, 1 lần/bài/24 giờ/trình duyệt + hàng rào mềm trong bộ nhớ. Chỉ POST (GET → 405 do Next tự trả).
// Chỉ đếm bài đang hiển thị; nháp / lên lịch / không có → 404 giống hệt nhau, không ghi gì. Không trả số lượt.

const NOT_FOUND = () => NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  let slug: string;
  try { slug = decodeURIComponent(raw); } catch { return NOT_FOUND(); }
  if (!isPlausibleSlug(slug)) return NOT_FOUND();

  try {
    const now = new Date();
    const where = { slug, ...publicArticleWhere(now) };
    const visible = await prisma.article.findFirst({ where, select: { id: true } });
    if (!visible) return NOT_FOUND();

    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim() || "unknown";
    const d = shouldCountView({
      slug, ip,
      cookie: req.cookies.get(VIEW_COOKIE)?.value,
      userAgent: req.headers.get("user-agent"),
      origin: req.headers.get("origin"),
      host: req.headers.get("host"),
      secFetchSite: req.headers.get("sec-fetch-site"),
    });
    const headers = { "Cache-Control": "no-store" };
    if (!d.count) return NextResponse.json({ counted: false }, { headers });

    const res = await prisma.article.updateMany({ where, data: { views: { increment: 1 } } });
    const out = NextResponse.json({ counted: res.count > 0 }, { headers });
    if (res.count > 0) {
      out.cookies.set(VIEW_COOKIE, d.setCookie, { httpOnly: true, sameSite: "lax", path: "/", maxAge: VIEW_COOKIE_MAX_AGE_S, secure: process.env.NODE_ENV === "production" });
    }
    return out;
  } catch (e) {
    console.error("[POST /api/articles/:slug/view]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
