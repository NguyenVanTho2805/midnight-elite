import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { isEnrollmentActive } from "@/lib/enrollment";
import { firstSafeHttpsLink, validateWorkLink } from "@/lib/mediaLink";

// POST /api/lessons/[id]/azota-done — học sinh bấm "Em đã làm xong" cho bài Azota của bài giảng, kèm (không bắt buộc) LINK bài làm.
// KiN không biết em đã làm trên Azota chưa nên đây là lời khai của em; gia sư thấy "đã làm / chưa làm" ở màn soạn bài.
// Lưu vào bảng riêng LessonAzotaDone (KHÔNG tạo Assignment ảo: Assignment ảo lọt vào danh sách bài tập, hàng đợi chấm và số "chưa chấm" của gia sư).
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

  const row = await prisma.lessonAzotaDone.upsert({
    where: { lessonId_userId: { lessonId, userId: auth.userId } },
    create: { lessonId, userId: auth.userId, kind, linkUrl: fileUrl || null },
    update: { kind, linkUrl: fileUrl || null, doneAt: new Date() },
    select: { kind: true, linkUrl: true, doneAt: true },
  });
  return NextResponse.json({ done: true, kind: row.kind, link: row.linkUrl, submittedAt: row.doneAt });
}

// DELETE — em bấm nhầm, bỏ đánh dấu.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") return NextResponse.json({ error: "Chỉ học viên" }, { status: 403 });
  const { id: lessonId } = await params;
  await prisma.lessonAzotaDone.deleteMany({ where: { lessonId, userId: auth.userId } });
  return NextResponse.json({ done: false });
}

// GET — trạng thái của chính em (để hiện "Em đã làm xong" đúng khi mở lại trang). Chỉ học viên đã ghi danh lớp chứa bài.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "student") return NextResponse.json({ error: "Chỉ học viên" }, { status: 403 });
  const { id: lessonId } = await params;
  const row = await prisma.lessonAzotaDone.findUnique({ where: { lessonId_userId: { lessonId, userId: auth.userId } }, select: { kind: true, linkUrl: true, doneAt: true } });
  return NextResponse.json({ done: !!row, kind: row?.kind ?? null, link: row?.linkUrl ?? null, submittedAt: row?.doneAt ?? null }, { headers: { "Cache-Control": "no-store" } });
}
