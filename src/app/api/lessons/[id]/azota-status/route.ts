import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/lessons/[id]/azota-status — gia sư xem học sinh nào của lớp đã bấm "Em đã làm xong" bài Azota, học sinh nào chưa. Chỉ chủ lớp / quản trị.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  const { id: lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { section: { select: { courseId: true, course: { select: { ownerId: true } } } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });
  if (!ownsResource(auth, lesson.chapter.section.course.ownerId)) return NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 });

  const courseId = lesson.chapter.section.courseId;
  const [students, subs] = await Promise.all([
    prisma.enrollment.findMany({ where: { courseId, status: "active" }, select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.assignmentSubmission.findMany({ where: { assignmentId: `azota-${lessonId}` }, select: { userId: true, kind: true, fileUrl: true, submittedAt: true } }),
  ]);
  const byUser = new Map(subs.map(s => [s.userId, s]));
  const rows = students.map(e => {
    const s = byUser.get(e.user.id);
    return { userId: e.user.id, name: e.user.name, done: !!s, kind: s?.kind ?? null, link: s?.fileUrl || null, submittedAt: s?.submittedAt ?? null };
  });
  return NextResponse.json({ total: rows.length, done: rows.filter(r => r.done).length, rows }, { headers: { "Cache-Control": "no-store" } });
}
