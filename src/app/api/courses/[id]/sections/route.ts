import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/courseAccessServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng (content.edit.any). Giáo viên bộ môn: 403 ROLE_FORBIDDEN (không tạo phần).
  const acc = await requireCourseAccess(courseId, "content.edit.any");
  if (!acc.ok) return acc.res;

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
