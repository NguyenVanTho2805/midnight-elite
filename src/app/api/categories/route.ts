import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const groups = await prisma.course.groupBy({
    by: ["category"],
    _count: { id: true },
    orderBy: { category: "asc" },
  });

  const categories = groups.map((g, i) => ({
    id: i + 1,
    name: g.category,
    courseCount: g._count.id,
  }));

  return NextResponse.json({ categories });
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

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
