import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseAccessBy, roleForbidden } from "@/lib/courseAccessServer";
import { canEditChapter } from "@/lib/courseAccess";

// GET /api/lessons/[id]/azota-status — gia sư xem học sinh nào của lớp đã bấm "Em đã làm xong" bài Azota, học sinh nào chưa. Chỉ chủ lớp / quản trị.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: lessonId } = await params;
  // TUT-dong-giang: chấm / xem trạng thái nộp Azota = `grade` (chủ, quản trị, đồng giảng; bộ môn chỉ bài trong nhóm của mình).
  const acc = await requireCourseAccessBy(async () => (await prisma.lesson.findUnique({ where: { id: lessonId }, select: { chapter: { select: { section: { select: { courseId: true } } } } } }))?.chapter.section.courseId ?? null, "Không tìm thấy bài học", "grade");
  if (!acc.ok) return acc.res;
  const lesson = (await prisma.lesson.findUnique({ where: { id: lessonId }, select: { chapter: { select: { teacherId: true, section: { select: { courseId: true } } } } } }))!;
  if (!canEditChapter(acc.role, acc.session.userId, lesson.chapter.teacherId)) return roleForbidden();

  const courseId = lesson.chapter.section.courseId;
  const [students, subs] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.lessonAzotaDone.findMany({ where: { lessonId }, select: { userId: true, kind: true, linkUrl: true, doneAt: true } }),
  ]);
  const byUser = new Map(subs.map(s => [s.userId, s]));
  const rows = students.map(e => {
    const s = byUser.get(e.user.id);
    return { userId: e.user.id, name: e.user.name, done: !!s, kind: s?.kind ?? null, link: s?.linkUrl || null, submittedAt: s?.doneAt ?? null };
  });
  return NextResponse.json({ total: rows.length, done: rows.filter(r => r.done).length, rows }, { headers: { "Cache-Control": "no-store" } });
}
