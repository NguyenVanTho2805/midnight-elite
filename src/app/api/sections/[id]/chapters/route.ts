import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: sectionId } = await params;
  const { title, order }  = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Thiếu tiêu đề" }, { status: 400 });
  if (order !== undefined && order !== null && (typeof order !== "number" || !Number.isFinite(order))) {
    return NextResponse.json({ error: "order phải là số" }, { status: 400 });
  }

  const maxOrder = await prisma.chapter.aggregate({ where: { sectionId }, _max: { order: true } });
  const chapter = await prisma.chapter.create({
    data: {
      id:        `c-${crypto.randomUUID()}`,
      title:     title.trim(),
      order:     order ?? (maxOrder._max.order ?? 0) + 1,
      sectionId,
    },
  });
  return NextResponse.json(chapter, { status: 201 });
}
