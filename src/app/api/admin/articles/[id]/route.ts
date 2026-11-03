import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { noticeArticlePublishedNow } from "@/lib/articleNoticeServer";
import { validateArticleText } from "@/lib/articleValidate";
import { cleanArticleSource } from "@/lib/articleSource";
import { logAction } from "@/lib/auditLog";
import { cleanCoverCaption, parseSchedule, checkNotPast } from "@/lib/articlesPublic"; // BU-07

// ADM-001: các trường "nội dung" được phép sửa qua PATCH — dùng để ghi `article.update` kèm tên trường đã gửi.
// `authorId` cố ý KHÔNG có ở đây và không bao giờ được spread vào `data`: tác giả là người tạo bài, không đổi qua body.
const UPDATABLE_FIELDS = ["title", "slug", "excerpt", "content", "category", "author", "tag", "isPinned", "readTime", "sourceUrl", "sourceName", "coverImage", "coverCaption", "publishedAt"] as const;

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
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không phải JSON hợp lệ" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });

    if (body.title !== undefined && typeof body.title !== "string") return NextResponse.json({ error: "title phải là chuỗi" }, { status: 400 });
    if (body.published !== undefined && typeof body.published !== "boolean") return NextResponse.json({ error: "published phải là true/false" }, { status: 400 });
    if (body.slug !== undefined && typeof body.slug !== "string") return NextResponse.json({ error: "slug phải là chuỗi" }, { status: 400 });
    if (typeof body.slug === "string") body.slug = body.slug.trim();
    // ADM-002: chỉ kiểm các trường được gửi (bài cũ ngắn vẫn đổi được `published`); slug chỉ kiểm khi ĐỔI sang giá trị mới.
    const bad = validateArticleText({ title: body.title, slug: body.slug, content: body.content }, { slugChanged: body.slug !== existing.slug });
    if (bad) return NextResponse.json({ error: bad.error, field: bad.field }, { status: 400 });
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

    // BU-07: chú thích ảnh bìa + giờ đăng. Giờ trống khi bài chưa đăng/đang lên lịch = đăng ngay; bài đã đăng (quá khứ) giữ giờ cũ.
    const cap = body.coverCaption !== undefined ? cleanCoverCaption(body.coverCaption) : null;
    if (cap && !cap.ok) return NextResponse.json({ error: cap.error }, { status: 400 });
    const sched = parseSchedule(body.publishedAt);
    if (!sched.ok) return NextResponse.json({ error: sched.error }, { status: 400 });
    const wasFuture = !!existing.publishedAt && existing.publishedAt.getTime() > Date.now();
    // Bài đã hiện cho khách rồi (đăng, giờ đã qua) được sửa thoải mái giờ đăng cũ (ô datetime-local cắt giây); chỉ chặn khi ĐẶT MỚI vào quá khứ.
    const alreadyLive = wasPublished && !wasFuture;
    if (willPublish && sched.value && !alreadyLive && !checkNotPast(sched.value)) return NextResponse.json({ error: "Giờ đăng không được ở quá khứ" }, { status: 400 });
    const newPublishedAt: Date | undefined =
      willPublish && sched.value ? sched.value
      : willPublish && (!wasPublished || wasFuture) ? new Date()
      : undefined;

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
        ...(newPublishedAt && { publishedAt: newPublishedAt }),
        ...(cap && cap.ok && { coverCaption: cap.value }),
        ...(srcData ?? {}),
      },
    });

    // ADM-001: nhật ký sau khi update thành công. Chỉ gửi { published } → đúng MỘT dòng publish/unpublish, không có dòng update.
    const fields = UPDATABLE_FIELDS.filter(k => body[k] !== undefined);
    if (fields.length > 0) await logAction(auth.userId, "article.update", "Article", updated.id, { slug: updated.slug, fields });
    if (!wasPublished && willPublish) await logAction(auth.userId, "article.publish", "Article", updated.id, { slug: updated.slug });
    else if (wasPublished && body.published === false) await logAction(auth.userId, "article.unpublish", "Article", updated.id, { slug: updated.slug });

    // BU-07: báo khi bài VỪA trở nên hiển thị (đăng mới, hoặc bài lên lịch được kéo về hiện tại); bài đặt lịch tương lai chưa báo.
    if (willPublish && (!wasPublished || wasFuture) && updated.publishedAt && updated.publishedAt.getTime() <= Date.now()) {
      // ADM-002: tối đa MỘT thông báo cho mỗi bài — bật → tắt → bật lại đăng không báo lần hai (khoá article.notified.<id>; người nhận loại tài khoản ẩn / hệ thống như cron).
      await noticeArticlePublishedNow({ id: updated.id, slug: updated.slug, title: updated.title });
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
