import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccessBy } from "@/lib/courseAccessServer";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: sửa phần = chủ / quản trị / đồng giảng; XOÁ cả phần = chỉ chủ / quản trị. Bộ môn không sửa phần.
  const acc = await requireCourseAccessBy(async () => (await prisma.section.findUnique({ where: { id }, select: { courseId: true } }))?.courseId ?? null, "Không tìm thấy phần", "content.edit.any");
  if (!acc.ok) return acc.res;

  const body   = await req.json();
  try {
    const section = await prisma.section.update({ where: { id }, data: { title: body.title, order: body.order } });
    return NextResponse.json(section);
  } catch {
    return NextResponse.json({ error: "Cập nhật phần thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: sửa phần = chủ / quản trị / đồng giảng; XOÁ cả phần = chỉ chủ / quản trị. Bộ môn không sửa phần.
  const acc = await requireCourseAccessBy(async () => (await prisma.section.findUnique({ where: { id }, select: { courseId: true } }))?.courseId ?? null, "Không tìm thấy phần", "content.delete_section");
  if (!acc.ok) return acc.res;

  try {
    await prisma.section.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá phần thất bại" }, { status: 400 });
  }
}
