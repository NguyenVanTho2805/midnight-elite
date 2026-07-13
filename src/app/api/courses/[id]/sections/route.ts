import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { ownerId: true } });
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
  if (!ownsResource(auth, course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  const { title, order } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Thiếu tiêu đề" }, { status: 400 });
  if (order !== undefined && order !== null && (typeof order !== "number" || !Number.isFinite(order))) {
    return NextResponse.json({ error: "order phải là số" }, { status: 400 });
  }

  const maxOrder = await prisma.section.aggregate({ where: { courseId }, _max: { order: true } });
  const section = await prisma.section.create({
    data: {
      id:       `s-${crypto.randomUUID()}`,
      title:    title.trim(),
      order:    order ?? (maxOrder._max.order ?? 0) + 1,
      courseId,
    },
  });
  return NextResponse.json(section, { status: 201 });
}
