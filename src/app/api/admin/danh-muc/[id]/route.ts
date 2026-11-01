// CAT-02 (4.4) — đổi tên (một giao dịch với mọi khoá) và xoá danh mục. Gia sư 403. Trùng tên → 409 (không gộp ngầm).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { renameCategory, lockCategories } from "@/lib/courseCategoryServer";

export const dynamic = "force-dynamic";
const NO_TEACHER = "Chỉ quản trị viên được quản lý danh mục";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole === "teacher") return NextResponse.json({ error: NO_TEACHER }, { status: 403 });
  try {
    const { id } = await ctx.params;
    let body: { name?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 }); }
    const r = await renameCategory({ id, newName: body?.name });
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.existing ? { existing: r.existing } : {}) }, { status: r.status });
    await logAction(auth.userId, "course_category.rename", "CourseCategory", r.category.id, { from: r.from, to: r.category.name, renamedCourses: r.renamedCourses });
    return NextResponse.json({ category: r.category, renamedCourses: r.renamedCourses });
  } catch (e) {
    console.error("[admin/danh-muc PUT]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole === "teacher") return NextResponse.json({ error: NO_TEACHER }, { status: 403 });
  try {
    const { id } = await ctx.params;
    // Đếm khoá + xoá trong một giao dịch có khoá tư vấn: không ai đổi tên/đặt thứ tự chen vào giữa.
    const out = await prisma.$transaction(async tx => {
      await lockCategories(tx);
      const cat = await tx.courseCategory.findUnique({ where: { id } });
      if (!cat) return { status: 404 as const };
      const n = await tx.course.count({ where: { category: cat.name } });
      if (n > 0) return { status: 409 as const, n };
      await tx.courseCategory.delete({ where: { id } });
      await tx.auditLog.create({ data: { actorId: auth.userId, action: "course_category.delete", resourceType: "CourseCategory", resourceId: id, metadata: { name: cat.name } } });
      return { status: 200 as const };
    });
    if (out.status === 404) return NextResponse.json({ error: "Không tìm thấy danh mục" }, { status: 404 });
    if (out.status === 409) return NextResponse.json({ error: `Còn ${out.n} khoá học đang dùng danh mục này`, courses: out.n }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/danh-muc DELETE]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
