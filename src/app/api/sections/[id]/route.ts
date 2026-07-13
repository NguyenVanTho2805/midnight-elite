import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const existing = await prisma.section.findUnique({ where: { id }, include: { course: { select: { ownerId: true } } } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy phần" }, { status: 404 });
  if (!ownsResource(auth, existing.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  const body   = await req.json();
  try {
    const section = await prisma.section.update({ where: { id }, data: { title: body.title, order: body.order } });
    return NextResponse.json(section);
  } catch {
    return NextResponse.json({ error: "Cập nhật phần thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const existing = await prisma.section.findUnique({ where: { id }, include: { course: { select: { ownerId: true } } } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy phần" }, { status: 404 });
  if (!ownsResource(auth, existing.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  try {
    await prisma.section.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá phần thất bại" }, { status: 400 });
  }
}
