// CAT-02 (4.1) — danh sách khoá học mỏng cho trang quản trị. Gia sư chỉ thấy khoá của mình. KHÔNG trả link nhóm/link học, màu nền, mô tả.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownerScopeWhere } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { buildFacets, type CatalogRow, type ClassStatus } from "@/lib/courseCatalogAdmin";

export const dynamic = "force-dynamic";
const LIMIT = 1000;

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  try {
    const found = await prisma.course.findMany({
      where: ownerScopeWhere(auth),
      orderBy: { sortOrder: "asc" },
      take: LIMIT + 1,
      select: {
        id: true, adminId: true, name: true, adminName: true, category: true, instructor: true, ownerId: true,
        status: true, classStatus: true, capacity: true, price: true, createdAt: true,
        owner: { select: { name: true } },
      },
    });
    const truncated = found.length > LIMIT;
    const list = truncated ? found.slice(0, LIMIT) : found;
    const counts = list.length
      ? await prisma.enrollment.groupBy({ by: ["courseId"], where: { status: "active", courseId: { in: list.map(c => c.id) } }, _count: { _all: true } })
      : [];
    const enrolledOf = new Map(counts.map(g => [g.courseId, g._count._all]));
    const rows: CatalogRow[] = list.map(c => ({
      id: c.id, adminId: c.adminId, name: c.name, adminName: c.adminName, category: c.category,
      tutor: { id: c.ownerId, name: c.owner?.name || c.instructor },
      status: c.status,
      classStatus: (c.classStatus === "closed" || c.classStatus === "paused" ? c.classStatus : "open") as ClassStatus,
      enrolled: enrolledOf.get(c.id) ?? 0, capacity: c.capacity, price: c.price, createdAt: c.createdAt,
    }));
    return NextResponse.json(
      { rows, facets: buildFacets(rows), truncated, canManageCategories: auth.adminRole !== "teacher" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/khoa-hoc]", e);
    return NextResponse.json({ error: "Không tải được danh sách khoá học" }, { status: 500 });
  }
}
