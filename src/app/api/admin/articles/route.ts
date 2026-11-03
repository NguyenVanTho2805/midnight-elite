import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { noticeArticlePublishedNow } from "@/lib/articleNoticeServer";
import { validateArticleText } from "@/lib/articleValidate";
import { cleanArticleSource } from "@/lib/articleSource";
import { logAction } from "@/lib/auditLog";
import { cleanCoverCaption, parseSchedule, checkNotPast } from "@/lib/articlesPublic"; // BU-07

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  try {
    const articles = await prisma.article.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true, slug: true, title: true, category: true, author: true,
        tag: true, isPinned: true, published: true, readTime: true,
        views: true, publishedAt: true, createdAt: true,
        coverImage: true, coverCaption: true, // BU-07
      },
    });
    return NextResponse.json(articles);
  } catch (e) {
    console.error("[GET /api/admin/articles]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không phải JSON hợp lệ" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
    // ADM-001: `authorId` KHÔNG đọc từ body — luôn là người đang đăng nhập (trước đây form không gửi → mọi bài có authorId "").
    const { title, excerpt, content, category, author, tag, isPinned, published, readTime } = body;

    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (typeof title !== "string" || (published !== undefined && typeof published !== "boolean")) return NextResponse.json({ error: "title phải là chuỗi, published phải là true/false" }, { status: 400 });
    if (!title?.trim() || !slug?.trim() || !excerpt?.trim() || !content?.trim() || !category?.trim()) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    // ADM-002: luật máy chủ (articleValidate.ts): slug 3–80 ký tự a-z0-9-, tiêu đề ≥ 10, nội dung ≥ 100.
    const bad = validateArticleText({ title, slug, content });
    if (bad) return NextResponse.json({ error: bad.error, field: bad.field }, { status: 400 });

    const src = cleanArticleSource({ sourceUrl: body.sourceUrl, sourceName: body.sourceName, coverImage: body.coverImage });
    if (!src.ok) return NextResponse.json({ error: src.error }, { status: 400 });

    // BU-07: chú thích ảnh bìa + giờ đăng (lên lịch). Giờ không múi giờ = giờ Việt Nam.
    const cap = cleanCoverCaption(body.coverCaption);
    if (!cap.ok) return NextResponse.json({ error: cap.error }, { status: 400 });
    const sched = parseSchedule(body.publishedAt);
    if (!sched.ok) return NextResponse.json({ error: sched.error }, { status: 400 });
    if (published && sched.value && !checkNotPast(sched.value)) return NextResponse.json({ error: "Giờ đăng không được ở quá khứ" }, { status: 400 });

    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug này đã tồn tại, hãy đổi slug khác" }, { status: 409 });
    }

    const article = await prisma.article.create({
      data: {
        title:       title.trim(),
        slug,
        excerpt:     excerpt.trim(),
        content:     content.trim(),
        category:    category.trim(),
        author:      author?.trim() || "Admin",
        authorId:    auth.userId,
        tag:         tag?.trim() || null,
        isPinned:    isPinned ?? false,
        published:   published ?? false,
        readTime:    Number(readTime) || 5,
        publishedAt: published ? (sched.value ?? new Date()) : null,
        coverCaption: cap.value,
        ...src.value,
      },
    });

    // ADM-001: ghi nhật ký SAU khi ghi DB thành công; bài tạo ở trạng thái đăng ghi thêm article.publish để lọc "Đăng bài viết" thấy đủ.
    await logAction(auth.userId, "article.create", "Article", article.id, { slug: article.slug, published: article.published });
    if (article.published) await logAction(auth.userId, "article.publish", "Article", article.id, { slug: article.slug });

    // ADM-002: báo học sinh tối đa MỘT lần cho mỗi bài (khoá article.notified.<id>); bài lên lịch tương lai để cron báo khi tới giờ (BU-07).
    if (article.published && article.publishedAt && article.publishedAt.getTime() <= Date.now()) {
      await noticeArticlePublishedNow({ id: article.id, slug: article.slug, title: article.title });
    }

    return NextResponse.json(article, { status: 201 });
  } catch (e) {
    console.error("[articles/POST]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
