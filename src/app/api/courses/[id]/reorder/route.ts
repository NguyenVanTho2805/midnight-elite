import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess, roleForbidden } from "@/lib/courseAccessServer";
import { canDo } from "@/lib/courseAccess";

const MAX_ITEMS = 1000;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng sắp xếp mọi mục; giáo viên bộ môn chỉ BÀI trong nhóm giao cho mình (kiểm bên dưới).
  const acc = await requireCourseAccess(courseId, "content.edit.own");
  if (!acc.ok) return acc.res;
  const onlyOwnGroups = !canDo(acc.role, "content.edit.any");

  const body = await req.json().catch(() => null) as { type?: unknown; items?: unknown } | null;
  const type = body?.type;
  const items = body?.items;
  if (type !== "section" && type !== "chapter" && type !== "lesson") return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const list: { id: string; order: number; parentId?: string }[] = [];
  for (const it of items) {
    const o = it as { id?: unknown; order?: unknown; parentId?: unknown } | null;
    if (!o || typeof o.id !== "string" || !o.id || typeof o.order !== "number" || !Number.isInteger(o.order)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    if (o.parentId !== undefined && o.parentId !== null && (typeof o.parentId !== "string" || !o.parentId)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    list.push({ id: o.id, order: o.order, ...(typeof o.parentId === "string" ? { parentId: o.parentId } : {}) });
  }

  // V6 (BU-02): quyền theo [id] chưa đủ. Mọi mục — và mọi nơi chúng được chuyển tới (parentId) — phải thuộc ĐÚNG lớp này, nếu không gia sư A
  // kéo được bài giảng của lớp B sang chương của mình (lấy link học liệu) hoặc nhét bài vào chương của lớp người khác. Sai một mục ⇒ không ghi gì.
  const ids = [...new Set(list.map(i => i.id))];
  const parents = [...new Set(list.flatMap(i => (i.parentId ? [i.parentId] : [])))];
  const [owned, ownedParents] = await Promise.all([
    type === "section" ? prisma.section.findMany({ where: { id: { in: ids }, courseId }, select: { id: true } })
      : type === "chapter" ? prisma.chapter.findMany({ where: { id: { in: ids }, section: { courseId } }, select: { id: true } })
      : prisma.lesson.findMany({ where: { id: { in: ids }, chapter: { section: { courseId } } }, select: { id: true } }),
    !parents.length ? Promise.resolve([] as { id: string }[])
      : type === "chapter" ? prisma.section.findMany({ where: { id: { in: parents }, courseId }, select: { id: true } })
      : type === "lesson" ? prisma.chapter.findMany({ where: { id: { in: parents }, section: { courseId } }, select: { id: true } })
      : Promise.resolve([] as { id: string }[]),
  ]);
  if (owned.length !== ids.length || (type === "section" && parents.length) || ownedParents.length !== parents.length)
    return NextResponse.json({ error: "Mục không thuộc lớp này" }, { status: 403 });
  if (onlyOwnGroups) {
    if (type !== "lesson") return roleForbidden();
    const me = acc.session.userId;
    const [lessonsOk, parentsOk] = await Promise.all([
      prisma.lesson.count({ where: { id: { in: ids }, chapter: { teacherId: me } } }),
      parents.length ? prisma.chapter.count({ where: { id: { in: parents }, teacherId: me } }) : Promise.resolve(0),
    ]);
    if (lessonsOk !== ids.length || parentsOk !== parents.length) return roleForbidden();
  }

  try {
    await prisma.$transaction(
      list.map(({ id, order, parentId }) => {
        if (type === "section") return prisma.section.update({ where: { id }, data: { order } });
        if (type === "chapter") return prisma.chapter.update({ where: { id }, data: { order, ...(parentId ? { sectionId: parentId } : {}) } });
        return prisma.lesson.update({ where: { id }, data: { order, ...(parentId ? { chapterId: parentId } : {}) } });
      })
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[PATCH /api/courses/[id]/reorder]", e);
    return NextResponse.json({ error: "Sắp xếp thất bại" }, { status: 500 });
  }
}
