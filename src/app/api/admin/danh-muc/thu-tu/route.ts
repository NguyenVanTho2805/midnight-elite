// CAT-02 (4.5) — đặt thứ tự danh mục. `ids` phải là TOÀN BỘ danh mục; lệch tập → 409 + `current`. Gia sư 403.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { validateOrderIds } from "@/lib/courseCatalogAdmin";
import { syncCourseCategories } from "@/lib/courseCategoryServer";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole === "teacher") return NextResponse.json({ error: "Chỉ quản trị viên được quản lý danh mục" }, { status: 403 });
  try {
    let body: { ids?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 }); }
    await syncCourseCategories();
    const result = await prisma.$transaction(async tx => {
      const cur = await tx.courseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true } });
      const currentIds = cur.map(c => c.id);
      const v = validateOrderIds(body?.ids, currentIds);
      if (!v.ok) return { v, currentIds };
      const ids = body.ids as string[];
      for (let i = 0; i < ids.length; i++) await tx.courseCategory.update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
      return { v, currentIds, count: ids.length };
    });
    if (!result.v.ok) {
      return NextResponse.json(
        { error: result.v.error, ...(result.v.status === 409 ? { current: result.currentIds } : {}) },
        { status: result.v.status },
      );
    }
    await logAction(auth.userId, "course_category.reorder", "CourseCategory", "order", { count: result.count! });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/danh-muc/thu-tu]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
