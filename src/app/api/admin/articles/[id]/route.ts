import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    const body = await req.json();

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

    if (body.slug && body.slug !== existing.slug) {
      const slugConflict = await prisma.article.findUnique({ where: { slug: body.slug } });
      if (slugConflict) return NextResponse.json({ error: "Slug đã tồn tại" }, { status: 409 });
    }

    const wasPublished = existing.published;
    const willPublish  = body.published ?? existing.published;

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(body.title     !== undefined && { title:     body.title.trim()     }),
        ...(body.slug      !== undefined && { slug:      body.slug.trim()      }),
        ...(body.excerpt   !== undefined && { excerpt:   body.excerpt.trim()   }),
        ...(body.content   !== undefined && { content:   body.content.trim()   }),
        ...(body.category  !== undefined && { category:  body.category.trim()  }),
        ...(body.author    !== undefined && { author:    body.author.trim()    }),
        ...(body.tag       !== undefined && { tag:       body.tag?.trim() || null }),
        ...(body.isPinned  !== undefined && { isPinned:  body.isPinned         }),
        ...(body.published !== undefined && { published: body.published        }),
        ...(body.readTime  !== undefined && { readTime:  Number(body.readTime) }),
        ...(!wasPublished && willPublish && { publishedAt: new Date() }),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[articles/PATCH]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
  }
}
