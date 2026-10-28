import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanArticleSource } from "@/lib/articleSource";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const slug     = searchParams.get("slug") ?? undefined;

  try {
    if (slug) {
      const article = await prisma.article.findUnique({
        where: { slug, published: true },
        select: {
          id: true, slug: true, title: true, excerpt: true, content: true,
          category: true, author: true, tag: true, isPinned: true,
          readTime: true, views: true, publishedAt: true, createdAt: true,
          sourceUrl: true, sourceName: true, coverImage: true,
        },
      });
      if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

      prisma.article.update({ where: { slug }, data: { views: { increment: 1 } } }).catch(() => {});

      // Nguồn + ảnh bìa đi qua cùng bộ kiểm như lúc lưu: dữ liệu lạ trong DB (sửa tay) không bao giờ thành href / src của trang công khai.
      const src = cleanArticleSource(article);
      return NextResponse.json({ ...article, ...(src.ok ? src.value : { sourceUrl: null, sourceName: null, coverImage: null }) });
    }

    const where = {
      published: true,
      ...(category ? { category } : {}),
    };

    const articles = await prisma.article.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, slug: true, title: true, excerpt: true, category: true,
        author: true, tag: true, isPinned: true, readTime: true,
        views: true, publishedAt: true, createdAt: true,
      },
    });

    return NextResponse.json(articles);
  } catch (e) {
    console.error("[GET /api/articles]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
