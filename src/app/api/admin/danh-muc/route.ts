// CAT-02 (4.3) — danh mục khoá học: GET (kèm đếm, đồng bộ lười) và POST (tạo). Chỉ quản trị trung tâm; gia sư 403.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { validateCategoryName } from "@/lib/courseCatalogAdmin";
import { syncCourseCategories, findCategoryConflict } from "@/lib/courseCategoryServer";

export const dynamic = "force-dynamic";
const NO_TEACHER = "Chỉ quản trị viên được quản lý danh mục";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole === "teacher") return NextResponse.json({ error: NO_TEACHER }, { status: 403 });
  try {
    // CỐ Ý: GET ghi DB. Đồng bộ lười từ Course.category cũ (tên danh mục trước đây chỉ là chuỗi trên khoá) sang bảng
    // course_categories. Idempotent (skipDuplicates, chỉ tạo dòng còn thiếu, không đổi dòng có sẵn), an toàn khi gọi song song;
    // không ghi audit vì là hệ thống tự điền, không phải thao tác của người. Nợ: chuyển sang một lần POST/migration.
    await syncCourseCategories();
    const [rows, grouped] = await Promise.all([
      prisma.courseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.course.groupBy({ by: ["category", "status", "classStatus"], _count: { _all: true } }),
    ]);
    const agg = new Map<string, { total: number; shown: number; hidden: number; openForJoin: number }>();
    for (const g of grouped) {
      const a = agg.get(g.category) ?? { total: 0, shown: 0, hidden: 0, openForJoin: 0 };
      const n = g._count._all;
      a.total += n;
      if (g.status) a.shown += n; else a.hidden += n;
      if (g.classStatus === "open") a.openForJoin += n;
      agg.set(g.category, a);
    }
    const categories = rows.map(r => ({
      id: r.id, name: r.name, slug: r.slug, sortOrder: r.sortOrder,
      courses: agg.get(r.name) ?? { total: 0, shown: 0, hidden: 0, openForJoin: 0 },
    }));
    return NextResponse.json({ categories, canEdit: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/danh-muc GET]", e);
    return NextResponse.json({ error: "Không tải được danh mục" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole === "teacher") return NextResponse.json({ error: NO_TEACHER }, { status: 403 });
  try {
    let body: { name?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 }); }
    const v = validateCategoryName(body?.name);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    await syncCourseCategories();
    const clash = await findCategoryConflict(v.slug, null);
    if (clash) return NextResponse.json({ error: "Đã có danh mục tên này", existing: clash }, { status: 409 });
    const max = await prisma.courseCategory.aggregate({ _max: { sortOrder: true } });
    let category;
    try {
      category = await prisma.courseCategory.create({ data: { name: v.name, slug: v.slug, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Đã có danh mục tên này" }, { status: 409 });
      throw e;
    }
    await logAction(auth.userId, "course_category.create", "CourseCategory", category.id, { name: category.name });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    console.error("[admin/danh-muc POST]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
