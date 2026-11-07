import { NextResponse } from "next/server";
import { requireStudentRole } from "@/lib/studentOnly";
import { prisma } from "@/lib/prisma";
import { suspendedLessonBlock } from "@/lib/suspendedContentServer";
import { isLearnerVisible } from "@/lib/lessonStatus";

// BU-02-PHẲNG (R9): bài không tồn tại hoặc không Đã đăng ⇒ 404 (cả GET lẫn PUT). Ghi chú cũ vẫn còn trong DB, hiện lại khi mục được hiện lại.
async function lessonVisible(lessonId: string): Promise<boolean> {
  const l = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { status: true } });
  return !!l && isLearnerVisible(l.status);
}
const NOT_FOUND = () => NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

// GET /api/lesson-notes/[lessonId] — lấy ghi chú cá nhân của học sinh cho bài học
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await requireStudentRole();
  if (session instanceof NextResponse) return session;

  const { lessonId } = await params;
  // Đã nghỉ lớp (quyết định 06/11/2026): không đọc / ghi ghi chú của bài thuộc lớp đó nữa (bài miễn phí thì giữ).
  const blocked = await suspendedLessonBlock(session.userId, lessonId);
  if (blocked) return NextResponse.json(blocked, { status: 403 });
  if (!(await lessonVisible(lessonId))) return NOT_FOUND();
  const note = await prisma.lessonNote.findUnique({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    select: { text: true },
  });

  return NextResponse.json({ text: note?.text ?? "" });
}

// PUT /api/lesson-notes/[lessonId] — lưu (tạo hoặc cập nhật) ghi chú
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await requireStudentRole();
  if (session instanceof NextResponse) return session;

  const { lessonId } = await params;
  const blocked = await suspendedLessonBlock(session.userId, lessonId);
  if (blocked) return NextResponse.json(blocked, { status: 403 });
  if (!(await lessonVisible(lessonId))) return NOT_FOUND();
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string") {
    return NextResponse.json({ error: "Nội dung ghi chú không hợp lệ" }, { status: 400 });
  }

  if (text.trim() === "") {
    await prisma.lessonNote.deleteMany({ where: { userId: session.userId, lessonId } });
    return NextResponse.json({ text: "" });
  }

  const note = await prisma.lessonNote.upsert({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId, text },
    update: { text },
    select: { text: true },
  });

  return NextResponse.json(note);
}
