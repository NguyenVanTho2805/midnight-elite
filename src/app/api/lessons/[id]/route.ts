import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { canViewCourseContent } from "@/lib/lessonAccess";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { select: { section: { select: { courseId: true, course: { select: { ownerId: true } } } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  // Quản trị cấp 1 / nội dung: toàn quyền. Gia sư: chỉ lớp của mình (bài học thử miễn phí thì ai cũng xem được) — trước đây MỌI tài khoản admin,
  // kể cả gia sư của lớp khác, đọc được videoUrl / tài liệu của bài trả phí.
  // Học viên: chỉ khi đang ghi danh active khoá của bài học này. "pending_consent" chưa được học, "suspended" chỉ xem lại nội dung qua
  // route /context (R01) — route này trả raw lesson nên dùng active làm chuẩn, nhất quán với progress/[lessonId], assignments/[id]/submit sau PR #6.
  const { courseId, course } = lesson.chapter.section;
  const enrolled = session.role === "admin"
    ? null
    : await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } } });
  const fullAccess = canViewCourseContent(session, course, enrolled);
  if (!fullAccess && !(session.role === "admin" && lesson.isFree)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

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
    if (typeof data.documents === "string") {
      try {
        const parsed = JSON.parse(data.documents);
        if (!Array.isArray(parsed)) throw new Error("not an array");
      } catch {
        return NextResponse.json({ error: "documents phải là chuỗi JSON dạng mảng" }, { status: 400 });
      }
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
