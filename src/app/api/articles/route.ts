import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const slug     = searchParams.get("slug") ?? undefined;

  if (slug) {
    const article = await prisma.article.findUnique({
      where: { slug, published: true },
      select: {
        id: true, slug: true, title: true, excerpt: true, content: true,
        category: true, author: true, tag: true, isPinned: true,
        readTime: true, views: true, publishedAt: true, createdAt: true,
      },
    });
    if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

    await prisma.article.update({ where: { slug }, data: { views: { increment: 1 } } });

    return NextResponse.json(article);
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
}
