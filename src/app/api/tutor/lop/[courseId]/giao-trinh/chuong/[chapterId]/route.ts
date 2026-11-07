// G6 (BU-02-PHẲNG) — đổi tên nhóm (PATCH) và "Bỏ nhóm" (DELETE). Chỉ gia sư đã duyệt và là chủ lớp.
// DELETE: mọi mục trong chương chuyển về chương không nhóm rồi xoá chương trống; KHÔNG BAO GIỜ xoá Lesson. Chương ngầm ⇒ 400 "Đây không phải nhóm".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurriculumAccess, denyChapterEdit, resolveAssignableTeacher, roleForbidden } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";
import { renameGroup, ungroup } from "@/lib/giaoTrinhServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string; chapterId: string }> }) {
  const { courseId, chapterId } = await params;
  const auth = await requireCurriculumAccess(courseId);
  if (auth instanceof NextResponse) return auth;
  const denied = await denyChapterEdit(auth.acc, chapterId);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { title?: unknown; teacherId?: unknown } | null;
  // Giao nhóm cho một giáo viên của lớp: chỉ chủ / quản trị (teacher.role). Chạy TRƯỚC khi đổi tên để lỗi không để lại việc dở.
  let assign: string | null | undefined;
  if (body && "teacherId" in body) {
    if (!canDo(auth.acc.role, "teacher.role")) return roleForbidden();
    assign = await resolveAssignableTeacher(courseId, auth.acc.course.ownerId, body.teacherId);
    if (assign === undefined) return NextResponse.json({ error: "Người được giao phải là giáo viên đang dạy trong lớp" }, { status: 400, headers: NO_STORE });
  }
  if (assign !== undefined && body?.title === undefined) {
    const ch = await prisma.chapter.findFirst({ where: { id: chapterId, section: { is: { courseId } }, isImplicit: false }, select: { id: true, title: true } });
    if (!ch) return NextResponse.json({ error: "Không tìm thấy nhóm trong lớp này" }, { status: 404, headers: NO_STORE });
    await prisma.chapter.update({ where: { id: chapterId }, data: { teacherId: assign } });
    return NextResponse.json({ id: ch.id, title: ch.title, teacherId: assign }, { headers: NO_STORE });
  }
  const r = await renameGroup(courseId, chapterId, typeof body?.title === "string" ? body.title : "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  if (assign !== undefined) await prisma.chapter.update({ where: { id: chapterId }, data: { teacherId: assign } });
  return NextResponse.json({ id: r.id, title: r.title, ...(assign !== undefined ? { teacherId: assign } : {}) }, { headers: NO_STORE });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ courseId: string; chapterId: string }> }) {
  const { courseId, chapterId } = await params;
  const auth = await requireCurriculumAccess(courseId);
  if (auth instanceof NextResponse) return auth;
  const denied = await denyChapterEdit(auth.acc, chapterId);
  if (denied) return denied;
  const r = await ungroup(courseId, chapterId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  return NextResponse.json({ moved: r.moved }, { headers: NO_STORE });
}
