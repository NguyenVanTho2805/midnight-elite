import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { logAction } from "@/lib/auditLog";
import { renameCategory } from "@/lib/courseCategoryServer";

// FE-140 — danh mục là chuỗi DÙNG CHUNG trên Course của mọi gia sư (không có model riêng).
// Danh sách TÊN là chung cho mọi người (form tạo/sửa khoá học cần để chọn). Con số `courseCount` thì tuỳ người xem:
//   • admin_super / admin_content: mọi khoá (scope "all") và được đổi tên (canEdit)
//   • gia sư: chỉ khoá của chính mình (scope "mine") — không lộ quy mô khoá của gia sư khác; không được đổi tên
//   • khách / học viên: chỉ khoá đang công khai (scope "public")
export async function GET() {
  const session = await getSession();
  const isCenter = session?.role === "admin" && (session.adminRole === "admin_super" || session.adminRole === "admin_content");
  const isTeacher = session?.role === "admin" && session.adminRole === "teacher";
  const scope = isCenter ? "all" : isTeacher ? "mine" : "public";

  // CAT-02: thứ tự = thứ tự quản trị đã đặt (course_categories.sortOrder); tên chưa có dòng xếp cuối theo chữ cái. Chỉ ĐỌC — không ghi khi khách xem.
  const [rows, names, counted] = await Promise.all([
    prisma.courseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true, sortOrder: true } }),
    prisma.course.groupBy({ by: ["category"], orderBy: { category: "asc" } }),
    prisma.course.groupBy({
      by: ["category"], _count: { id: true },
      where: isCenter ? {} : isTeacher ? { ownerId: session!.userId } : { status: true },
    }),
  ]);
  const countOf = new Map(counted.map(g => [g.category, g._count.id]));
  const listed = new Set(rows.map(r => r.name));
  let next = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
  const ordered = [
    ...rows.map(r => ({ name: r.name, sortOrder: r.sortOrder })),
    ...names.map(g => g.category).filter(n => !listed.has(n)).sort((a, b) => a.localeCompare(b, "vi")).map(n => ({ name: n, sortOrder: ++next })),
  ];
  const categories = ordered.map((c, i) => ({ id: i + 1, name: c.name, courseCount: countOf.get(c.name) ?? 0, sortOrder: c.sortOrder }));

  return NextResponse.json({ categories, scope, canEdit: isCenter });
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  // Category là string dùng chung trên Course (không có model riêng) — đổi tên
  // sẽ ghi đè lên khoá học của MỌI giáo viên, nên chỉ admin_super/admin_content
  // được làm. Teacher có MANAGE_COURSES nhưng chỉ được sửa khoá học của mình.
  if (auth.adminRole === "teacher") {
    return NextResponse.json({ error: "Chỉ quản trị viên được đổi tên danh mục" }, { status: 403 });
  }

  let body: { oldName?: unknown; newName?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Tên không hợp lệ" }, { status: 400 }); }
  const oldName = typeof body.oldName === "string" ? body.oldName : "";
  const newName = typeof body.newName === "string" ? body.newName : "";
  if (!oldName || !newName || oldName === newName) {
    return NextResponse.json({ error: "Tên không hợp lệ" }, { status: 400 });
  }

  // CAT-02: dùng chung thư viện với /api/admin/danh-muc — một giao dịch, trùng tên → 409 (trước đây gộp ngầm), có nhật ký.
  try {
    const r = await renameCategory({ oldName, newName });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    await logAction(auth.userId, "course_category.rename", "CourseCategory", r.category.id, { from: r.from, to: r.category.name, renamedCourses: r.renamedCourses });
    return NextResponse.json({ success: true, renamedCourses: r.renamedCourses });
  } catch (e) {
    console.error("[categories PUT]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
