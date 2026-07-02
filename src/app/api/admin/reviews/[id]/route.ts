import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(guard)) return guard;

  const { id } = await params;
  const { status } = await req.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }
  const review = await prisma.courseReview.update({ where: { id }, data: { status } });
  return NextResponse.json({ review });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(guard)) return guard;

  const { id } = await params;
  await prisma.courseReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
