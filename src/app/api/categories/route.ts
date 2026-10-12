import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/lib/session";

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

  const [names, counted] = await Promise.all([
    prisma.course.groupBy({ by: ["category"], orderBy: { category: "asc" } }),
    prisma.course.groupBy({
      by: ["category"], _count: { id: true },
      where: isCenter ? {} : isTeacher ? { ownerId: session!.userId } : { status: true },
    }),
  ]);
  const countOf = new Map(counted.map(g => [g.category, g._count.id]));
  const categories = names.map((g, i) => ({ id: i + 1, name: g.category, courseCount: countOf.get(g.category) ?? 0 }));

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

  const { oldName, newName } = await req.json();
  if (!oldName || !newName || oldName === newName) {
    return NextResponse.json({ error: "Tên không hợp lệ" }, { status: 400 });
  }

  await prisma.course.updateMany({
    where: { category: oldName },
    data: { category: newName },
  });

  return NextResponse.json({ success: true });
}
