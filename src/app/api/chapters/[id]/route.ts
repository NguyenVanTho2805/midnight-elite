import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccessBy, resolveAssignableTeacher, roleForbidden } from "@/lib/courseAccessServer";
import { canDo, canEditChapter } from "@/lib/courseAccess";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng sửa mọi nhóm; bộ môn chỉ nhóm giao cho mình. Giao nhóm (teacherId) chỉ chủ / quản trị.
  const acc = await requireCourseAccessBy(async () => (await prisma.chapter.findUnique({ where: { id }, select: { section: { select: { courseId: true } } } }))?.section.courseId ?? null, "Không tìm thấy chương", "content.edit.own");
  if (!acc.ok) return acc.res;
  const existing = (await prisma.chapter.findUnique({ where: { id }, select: { teacherId: true } }))!;
  if (!canEditChapter(acc.role, acc.session.userId, existing.teacherId)) return roleForbidden();

  const body   = await req.json();
  let assign: string | null | undefined;
  if (body && "teacherId" in body) {
    if (!canDo(acc.role, "teacher.role")) return roleForbidden();
    assign = await resolveAssignableTeacher(acc.course.id, acc.course.ownerId, body.teacherId);
    if (assign === undefined) return NextResponse.json({ error: "Người được giao phải là giáo viên đang dạy trong lớp" }, { status: 400 });
  }
  try {
    const chapter = await prisma.chapter.update({ where: { id }, data: { title: body.title, order: body.order, ...(assign !== undefined ? { teacherId: assign } : {}) } });
    return NextResponse.json(chapter);
  } catch {
    return NextResponse.json({ error: "Cập nhật chương thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await requireCourseAccessBy(async () => (await prisma.chapter.findUnique({ where: { id }, select: { section: { select: { courseId: true } } } }))?.section.courseId ?? null, "Không tìm thấy chương", "content.edit.own");
  if (!acc.ok) return acc.res;
  const existing = (await prisma.chapter.findUnique({ where: { id }, select: { teacherId: true } }))!;
  if (!canEditChapter(acc.role, acc.session.userId, existing.teacherId)) return roleForbidden();

  try {
    await prisma.chapter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá chương thất bại" }, { status: 400 });
  }
}
