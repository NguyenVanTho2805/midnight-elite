import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { isEnrollmentActive } from "@/lib/enrollment";
import { validateLessonLinks, validateDocumentsJson, claimUploadedVideos } from "@/lib/lessonMediaServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { select: { section: { select: { courseId: true } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  // Admin: full access
  if (session.role === "admin") return NextResponse.json(lesson);

  // Student: chỉ access nếu đang enroll active khoá của bài học này.
  // "pending_consent" chưa được học, "suspended" chỉ xem lại nội dung qua
  // route /context (R01) — route này trả raw lesson nên dùng active làm chuẩn,
  // nhất quán với progress/[lessonId], assignments/[id]/submit sau PR #6.
  const courseId = lesson.chapter.section.courseId;
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
  });
  if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  return NextResponse.json(lesson);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const existing = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { include: { section: { include: { course: { select: { ownerId: true } } } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });
  if (!ownsResource(auth, existing.chapter.section.course.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
  }

  const body   = await req.json();
  try {
    const data: Record<string, unknown> = {};
    const allowed = [
      "title","code","type","duration","videoUrl","zoomUrl","azotaUrl","azotaDeadline",
      "adminNote","isLocked","isFree","statsVideos","statsMaterials","statsViews","order","documents",
    ];
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    // MD-01: báo lỗi sớm ở máy chủ (không chỉ ở trình duyệt) khi link video/Zoom/Azota sai hoặc dán nhầm ô. Chỉ kiểm ô ĐỔI so với bản đang lưu.
    const linkErr = validateLessonLinks(data, existing);
    if (linkErr) return NextResponse.json({ error: linkErr }, { status: 400 });
    if (typeof data.documents === "string") {
      const docErr = validateDocumentsJson(data.documents);
      if (docErr) return NextResponse.json({ error: docErr }, { status: 400 });
    }
    if ("videoUrl" in data) {
      const claimErr = await claimUploadedVideos({
        videoUrl: data.videoUrl as string | null, lessonId: id, courseId: existing.chapter.section.courseId,
        userId: auth.userId, isTeacher: auth.adminRole === "teacher",
      });
      if (claimErr) return NextResponse.json({ error: `Video bài giảng: ${claimErr}` }, { status: 400 });
    }
    const lesson = await prisma.lesson.update({ where: { id }, data });
    return NextResponse.json(lesson);
  } catch (e) {
    console.error("[PUT /api/lessons/[id]]", e);
    return NextResponse.json({ error: "Cập nhật bài học thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  try {
    // Get course ID before deleting to update count
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { chapter: { include: { section: { include: { course: { select: { ownerId: true } } } } } } },
    });
    if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });
    if (!ownsResource(auth, lesson.chapter.section.course.ownerId)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }

    // Course.lessons là số bài quảng cáo admin tự đặt — không tự đồng bộ theo
    // số Lesson thật (xem ghi chú tương tự ở route tạo bài học).
    await prisma.lesson.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá bài học thất bại" }, { status: 400 });
  }
}
