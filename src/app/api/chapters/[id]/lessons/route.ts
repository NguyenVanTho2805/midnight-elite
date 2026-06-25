import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const { id: chapterId } = await params;
    const body = await req.json();

    if (!body.title?.trim()) return NextResponse.json({ error: "Thiếu tiêu đề" }, { status: 400 });
    if (body.order !== undefined && body.order !== null && (typeof body.order !== "number" || !Number.isFinite(body.order))) {
      return NextResponse.json({ error: "order phải là số" }, { status: 400 });
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
      isLocked:      body.isLocked ?? true,
      isFree:        body.isFree ?? false,
      statsVideos:   body.statsVideos ?? 0,
      statsMaterials: body.statsMaterials ?? 0,
      statsViews:    body.statsViews ?? 0,
      order:         body.order ?? (maxOrder._max.order ?? 0) + 1,
      chapterId,
    };

    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, include: { section: true } });
    const courseId = chapter?.section?.courseId;

    // Tạo lesson và đồng bộ course.lessons trong cùng 1 transaction — tránh đếm bị lệch
    const lesson = await prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({ data: createData as Parameters<typeof prisma.lesson.create>[0]["data"] });
      if (courseId) {
        await tx.course.update({ where: { id: courseId }, data: { lessons: { increment: 1 } } });
      }
      return created;
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (e) {
    console.error("[POST /api/chapters/[id]/lessons]", e);
    return NextResponse.json({ error: "Tạo bài học thất bại", detail: String(e) }, { status: 500 });
  }
}
