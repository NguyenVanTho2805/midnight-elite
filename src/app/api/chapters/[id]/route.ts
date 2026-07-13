import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const existing = await prisma.chapter.findUnique({
    where: { id },
    include: { section: { include: { course: { select: { ownerId: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy chương" }, { status: 404 });
  if (!ownsResource(auth, existing.section.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

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
  const existing = await prisma.chapter.findUnique({
    where: { id },
    include: { section: { include: { course: { select: { ownerId: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy chương" }, { status: 404 });
  if (!ownsResource(auth, existing.section.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  try {
    await prisma.chapter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá chương thất bại" }, { status: 400 });
  }
}
