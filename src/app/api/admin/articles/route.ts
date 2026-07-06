import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

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
    const body = await req.json();
    const { title, slug, excerpt, content, category, author, authorId, tag, isPinned, published, readTime } = body;

    if (!title?.trim() || !slug?.trim() || !excerpt?.trim() || !content?.trim() || !category?.trim()) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug này đã tồn tại, hãy đổi slug khác" }, { status: 409 });
    }

    const article = await prisma.article.create({
      data: {
        title:       title.trim(),
        slug:        slug.trim(),
        excerpt:     excerpt.trim(),
        content:     content.trim(),
        category:    category.trim(),
        author:      author?.trim() || "Admin",
        authorId:    authorId ?? "",
        tag:         tag?.trim() || null,
        isPinned:    isPinned ?? false,
        published:   published ?? false,
        readTime:    Number(readTime) || 5,
        publishedAt: published ? new Date() : null,
      },
    });

    if (article.published) {
      const students = await prisma.user.findMany({ where: { role: "student" }, select: { id: true } });
      await notifyMany(students.map(s => s.id), {
        type:    "article_new",
        title:   "Bài viết mới",
        message: `Bài viết mới: "${article.title}"`,
        link:    `/tin-tuc/${article.slug}`,
      });
    }

    return NextResponse.json(article, { status: 201 });
  } catch (e) {
    console.error("[articles/POST]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
