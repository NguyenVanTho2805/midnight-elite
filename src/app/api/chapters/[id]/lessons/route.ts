import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { validateLessonLinks, validateDocumentsJson, claimUploadedVideos } from "@/lib/lessonMediaServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { id: chapterId } = await params;

    const chapterWithCourse = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { section: { include: { course: { select: { ownerId: true } } } } },
    });
    if (!chapterWithCourse) return NextResponse.json({ error: "Không tìm thấy chương" }, { status: 404 });
    if (!ownsResource(auth, chapterWithCourse.section.course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    const body = await req.json();

    if (!body.title?.trim()) return NextResponse.json({ error: "Thiếu tiêu đề" }, { status: 400 });
    if (body.order !== undefined && body.order !== null && (typeof body.order !== "number" || !Number.isFinite(body.order))) {
      return NextResponse.json({ error: "order phải là số" }, { status: 400 });
    }

    // MD-01: link sai / dán nhầm ô bị từ chối ngay ở máy chủ, kèm câu nói rõ lỗi gì và nên dán vào ô nào.
    const linkErr = validateLessonLinks(body);
    if (linkErr) return NextResponse.json({ error: linkErr }, { status: 400 });
    if (typeof body.documents === "string") {
      const docErr = validateDocumentsJson(body.documents);
      if (docErr) return NextResponse.json({ error: docErr }, { status: 400 });
    }

    const maxOrder = await prisma.lesson.aggregate({ where: { chapterId }, _max: { order: true } });
    const ts = Date.now();

    const createData: Record<string, unknown> = {
      id:            body.id ?? `l-${crypto.randomUUID()}`,
      code:          body.code ?? `L${Date.now()}`,
      title:         body.title.trim(),
      type:          body.type ?? "record",
      duration:      body.duration ?? null,
      videoUrl:      body.videoUrl ?? null,
      zoomUrl:       body.zoomUrl ?? null,
      azotaUrl:      body.azotaUrl ?? null,
      azotaDeadline: body.azotaDeadline ?? null,
      // Trước đây POST bỏ rơi documents và adminNote: tài liệu / ghi chú nhập lúc THÊM bài mới mất sạch, chỉ lúc SỬA mới lưu được.
      documents:     typeof body.documents === "string" ? body.documents : "[]",
      adminNote:     typeof body.adminNote === "string" && body.adminNote.trim() ? body.adminNote : null,
      isLocked:      body.isLocked ?? true,
      isFree:        body.isFree ?? false,
      statsVideos:   body.statsVideos ?? 0,
      statsMaterials: body.statsMaterials ?? 0,
      statsViews:    body.statsViews ?? 0,
      order:         body.order ?? (maxOrder._max.order ?? 0) + 1,
      chapterId,
    };

    // Course.lessons là số bài quảng cáo admin tự đặt (vd đề mục tiêu "103 bài"
    // dù giáo trình thật chưa soạn hết) — KHÔNG tự đồng bộ theo số Lesson thật,
    // nếu không số quảng cáo sẽ bị trôi lệch âm thầm mỗi lần soạn bài.
    const lesson = await prisma.lesson.create({
      data: createData as Parameters<typeof prisma.lesson.create>[0]["data"],
    });

    const claimErr = await claimUploadedVideos({
      videoUrl: lesson.videoUrl, lessonId: lesson.id, courseId: chapterWithCourse.section.courseId,
      userId: auth.userId, isTeacher: auth.adminRole === "teacher",
    });
    if (claimErr) {
      await prisma.lesson.delete({ where: { id: lesson.id } }).catch(() => {});
      return NextResponse.json({ error: `Video bài giảng: ${claimErr}` }, { status: 400 });
    }

    return NextResponse.json(lesson, { status: 201 });
  } catch (e) {
    console.error("[POST /api/chapters/[id]/lessons]", e);
    return NextResponse.json({ error: "Tạo bài học thất bại", detail: String(e) }, { status: 500 });
  }
}
