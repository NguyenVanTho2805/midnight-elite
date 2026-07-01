import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  await params;
  const body = await req.json();
  const { type, items } = body as { type: "section" | "chapter" | "lesson"; items: { id: string; order: number }[] };

  if (!["section", "chapter", "lesson"].includes(type) || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      items.map(({ id, order }) => {
        if (type === "section") return prisma.section.update({ where: { id }, data: { order } });
        if (type === "chapter") return prisma.chapter.update({ where: { id }, data: { order } });
        return prisma.lesson.update({ where: { id }, data: { order } });
      })
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/courses/[id]/reorder]", e);
    return NextResponse.json({ error: "Sắp xếp thất bại" }, { status: 500 });
  }
}
