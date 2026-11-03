import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";
import { cleanArticleSource } from "@/lib/articleSource";
import { logAction } from "@/lib/auditLog";

// ADM-001: các trường "nội dung" được phép sửa qua PATCH — dùng để ghi `article.update` kèm tên trường đã gửi.
// `authorId` cố ý KHÔNG có ở đây và không bao giờ được spread vào `data`: tác giả là người tạo bài, không đổi qua body.
const UPDATABLE_FIELDS = ["title", "slug", "excerpt", "content", "category", "author", "tag", "isPinned", "readTime", "sourceUrl", "sourceName", "coverImage"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    return NextResponse.json(article);
  } catch (e) {
    console.error("[GET /api/admin/articles/:id]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
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

    // Nguồn + ảnh bìa (NC2-051): chỉ kiểm khi body có nhắc tới; ô nào không gửi thì giữ giá trị đang có rồi kiểm cả bộ ba.
    let srcData: { sourceUrl: string | null; sourceName: string | null; coverImage: string | null } | null = null;
    if (body.sourceUrl !== undefined || body.sourceName !== undefined || body.coverImage !== undefined) {
      const c = cleanArticleSource({
        sourceUrl:  body.sourceUrl  !== undefined ? body.sourceUrl  : existing.sourceUrl,
        sourceName: body.sourceName !== undefined ? body.sourceName : existing.sourceName,
        coverImage: body.coverImage !== undefined ? body.coverImage : existing.coverImage,
      });
      if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
      srcData = c.value;
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
        ...(srcData ?? {}),
      },
    });

    // ADM-001: nhật ký sau khi update thành công. Chỉ gửi { published } → đúng MỘT dòng publish/unpublish, không có dòng update.
    const fields = UPDATABLE_FIELDS.filter(k => body[k] !== undefined);
    if (fields.length > 0) await logAction(auth.userId, "article.update", "Article", updated.id, { slug: updated.slug, fields });
    if (!wasPublished && willPublish) await logAction(auth.userId, "article.publish", "Article", updated.id, { slug: updated.slug });
    else if (wasPublished && body.published === false) await logAction(auth.userId, "article.unpublish", "Article", updated.id, { slug: updated.slug });

    if (!wasPublished && willPublish) {
      // ADM-001 (4.9a): không tạo thông báo cho học sinh đã ẩn.
      const students = await prisma.user.findMany({ where: { role: "student", deletedAt: null }, select: { id: true } });
      await notifyMany(students.map(s => s.id), {
        type:    "article_new",
        title:   "Bài viết mới",
        message: `Bài viết mới: "${updated.title}"`,
        link:    `/tin-tuc/${updated.slug}`,
      });
    }

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
    // ADM-001: đọc trước để nhật ký giữ được slug/title của bài đã xoá (bài viết vẫn xoá cứng — không có bản ghi con, tạo lại được).
    const existing = await prisma.article.findUnique({ where: { id }, select: { id: true, slug: true, title: true } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
    await prisma.article.delete({ where: { id } });
    await logAction(auth.userId, "article.delete", "Article", existing.id, { slug: existing.slug, title: existing.title });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
    }
    console.error("[articles/DELETE]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
