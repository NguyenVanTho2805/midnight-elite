import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const body   = await req.json();
  try {
    const chapter = await prisma.chapter.update({ where: { id }, data: { title: body.title, order: body.order } });
    return NextResponse.json(chapter);
  } catch {
    return NextResponse.json({ error: "Cập nhật chương thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    await prisma.chapter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá chương thất bại" }, { status: 400 });
  }
}
