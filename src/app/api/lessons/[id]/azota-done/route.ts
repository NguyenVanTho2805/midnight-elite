import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isEnrollmentActive } from "@/lib/enrollment";
import { firstSafeHttpsLink, validateWorkLink } from "@/lib/mediaLink";

// POST /api/lessons/[id]/azota-done — học sinh bấm "Em đã làm xong" cho bài Azota của bài giảng, kèm (không bắt buộc) LINK bài làm.
// KiN không biết em đã làm trên Azota chưa nên đây là lời khai của em; gia sư thấy "đã làm / chưa làm" ở màn soạn bài.
// Lưu vào AssignmentSubmission của một Assignment mode "azota" (tạo một lần, id cố định theo bài) nên dùng lại bảng nộp bài sẵn có và chấm điểm sẵn có.
// CHỈ lưu link dạng chữ (azota.vn). KHÔNG có đường nhận ảnh bài làm: học sinh dưới 16 tuổi.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") return NextResponse.json({ error: "Chỉ học viên mới đánh dấu đã làm bài" }, { status: 403 });
  const { id: lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { azotaUrl: true, title: true, chapter: { select: { section: { select: { courseId: true, course: { select: { ownerId: true } } } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });
  if (!firstSafeHttpsLink(lesson.azotaUrl)) return NextResponse.json({ error: "Bài học này không có bài Azota" }, { status: 400 });

  const courseId = lesson.chapter.section.courseId;
  const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: auth.userId, courseId } } });
  if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Bạn chưa ghi danh khoá học này" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { linkUrl?: unknown };
  let fileUrl = "", kind: "link" | "done" = "done";
  if (typeof body.linkUrl === "string" && body.linkUrl.trim()) {
    const w = validateWorkLink(body.linkUrl);
    if (!w.ok || !w.url) return NextResponse.json({ error: w.error ?? "Link bài làm chưa đúng" }, { status: 400 });
    fileUrl = w.url; kind = "link";
  }

  const assignmentId = `azota-${lessonId}`;
  await prisma.assignment.upsert({
    where: { id: assignmentId },
    create: { id: assignmentId, lessonId, title: `Bài Azota: ${lesson.title}`.slice(0, 200), mode: "azota", maxPoints: 10, ownerId: lesson.chapter.section.course.ownerId },
    update: {},
  });
  const sub = await prisma.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: auth.userId } },
    create: { assignmentId, userId: auth.userId, fileUrl, fileName: null, kind },
    update: { fileUrl, kind, submittedAt: new Date() },
    select: { id: true, kind: true, fileUrl: true, submittedAt: true },
  });
  return NextResponse.json({ done: true, kind: sub.kind, link: sub.fileUrl || null, submittedAt: sub.submittedAt });
}

// DELETE — em bấm nhầm, bỏ đánh dấu. Không xoá bài đã được chấm điểm.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") return NextResponse.json({ error: "Chỉ học viên" }, { status: 403 });
  const { id: lessonId } = await params;
  const assignmentId = `azota-${lessonId}`;
  const sub = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId, userId: auth.userId } }, select: { gradedAt: true } });
  if (!sub) return NextResponse.json({ done: false });
  if (sub.gradedAt) return NextResponse.json({ error: "Bài này đã được chấm điểm, không bỏ đánh dấu được" }, { status: 409 });
  await prisma.assignmentSubmission.delete({ where: { assignmentId_userId: { assignmentId, userId: auth.userId } } });
  return NextResponse.json({ done: false });
}
