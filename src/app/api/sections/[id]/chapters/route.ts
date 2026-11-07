import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccessBy } from "@/lib/courseAccessServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sectionId } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng tạo nhóm chung; giáo viên bộ môn tạo nhóm thì nhóm đó LUÔN giao cho chính họ (teacherId = me).
  const acc = await requireCourseAccessBy(async () => (await prisma.section.findUnique({ where: { id: sectionId }, select: { courseId: true } }))?.courseId ?? null, "Không tìm thấy phần", "content.edit.own");
  if (!acc.ok) return acc.res;

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
      ...(acc.role === "subject_teacher" ? { teacherId: acc.session.userId } : {}),
    },
  });
  return NextResponse.json(chapter, { status: 201 });
}
