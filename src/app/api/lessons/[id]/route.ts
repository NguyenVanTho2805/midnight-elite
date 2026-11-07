import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireCourseAccessBy, isActiveHelperOfCourse, roleForbidden } from "@/lib/courseAccessServer";
import { canEditChapter } from "@/lib/courseAccess";
import { isEnrollmentActive } from "@/lib/enrollment";
import { isCourseManager, lessonFor, type MediaContext } from "@/lib/mediaAccess";
import { isSuspended, suspendedBody, contactTutorHref } from "@/lib/suspendedContent";
import { validateLessonLinks, validateDocumentsJson, claimUploadedVideos, claimUploadedDocuments } from "@/lib/lessonMediaServer";
import { isLearnerVisible } from "@/lib/lessonStatus";

// MD-03: ownerId (định danh gia sư) chỉ dùng để kiểm quyền ở máy chủ, KHÔNG đi ra JSON. Trả bản chỉ còn chapter.section.courseId.
type LessonWithOwner = { chapter: { section: { courseId: string; course: { ownerId: string | null } } } };
function publicLesson<L extends LessonWithOwner>(lesson: L) {
  const { chapter, ...rest } = lesson;
  return { ...rest, chapter: { ...chapter, section: { courseId: chapter.section.courseId } } };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { select: { section: { select: { courseId: true, course: { select: { ownerId: true } } } } } } },
  });
  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  // MD-03: quản trị toàn quyền; gia sư chỉ bài của LỚP MÌNH — lớp người khác trả 403 (trước đây mọi tài khoản admin đều đọc được).
  if (session.role === "admin") {
    const ownerId = lesson.chapter.section.course.ownerId;
    // TUT-dong-giang: đồng giảng / bộ môn ĐANG HIỆU LỰC của lớp xem bài như quản lý lớp.
    const helper = await isActiveHelperOfCourse(session, lesson.chapter.section.courseId, ownerId);
    if (!isCourseManager({ userId: session.userId, role: "admin", adminRole: session.adminRole }, ownerId, helper)) {
      return NextResponse.json({ error: "Bạn không có quyền với khóa học này" }, { status: 403 });
    }
    const ctx: MediaContext = { viewer: { userId: session.userId, role: "admin", adminRole: session.adminRole }, courseOwnerId: ownerId, enrollment: null, coTeacher: helper };
    return NextResponse.json(lessonFor(ctx, publicLesson(lesson)));
  }

  // BU-02-PHẲNG (R2): bài Nháp/Ẩn không tồn tại với người học — 404 TRƯỚC kiểm ghi danh (không phân biệt "không có" với "nháp").
  if (!isLearnerVisible(lesson.status)) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  // Student: chỉ access nếu đang enroll active khoá của bài học này.
  // "pending_consent" chưa được học; "suspended" (đã nghỉ lớp) cũng không xem được nữa (quyết định 06/11/2026, thay R01) — route này
  // trả raw lesson nên dùng active làm chuẩn, nhất quán với progress/[lessonId], assignments/[id]/submit.
  const courseId = lesson.chapter.section.courseId;
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId } },
  });
  if (isSuspended(enrolled)) return NextResponse.json(suspendedBody(contactTutorHref({ id: courseId, ownerId: lesson.chapter.section.course.ownerId })), { status: 403, headers: { "Cache-Control": "private, no-store" } });
  if (!isEnrollmentActive(enrolled)) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  const ctx: MediaContext = { viewer: { userId: session.userId, role: "student" }, courseOwnerId: lesson.chapter.section.course.ownerId, enrollment: enrolled };
  return NextResponse.json(lessonFor(ctx, publicLesson(lesson)));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TUT-dong-giang: chủ / quản trị / đồng giảng soạn mọi bài; bộ môn chỉ bài trong nhóm giao cho mình.
  const acc = await requireCourseAccessBy(async () => (await prisma.lesson.findUnique({ where: { id }, select: { chapter: { select: { section: { select: { courseId: true } } } } } }))?.chapter.section.courseId ?? null, "Không tìm thấy bài học", "content.edit.own");
  if (!acc.ok) return acc.res;
  const auth = acc.session;
  const existing = (await prisma.lesson.findUnique({
    where: { id },
    include: { chapter: { include: { section: { include: { course: { select: { ownerId: true } } } } } } },
  }))!;
  if (!canEditChapter(acc.role, auth.userId, existing.chapter.teacherId)) return roleForbidden();

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
      // V8: tệp /api/media/<mã>/file phải có thật và do chính người lưu tải lên (gia sư không ghi mã tệp của người khác vào bài của mình).
      const fileErr = await claimUploadedDocuments({ documents: data.documents, lessonId: id, userId: auth.userId, isTeacher: auth.adminRole === "teacher", existingDocuments: existing.documents });
      if (fileErr) return NextResponse.json({ error: `Tài liệu: ${fileErr}` }, { status: 400 });
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
  const { id } = await params;
  const acc = await requireCourseAccessBy(async () => (await prisma.lesson.findUnique({ where: { id }, select: { chapter: { select: { section: { select: { courseId: true } } } } } }))?.chapter.section.courseId ?? null, "Không tìm thấy bài học", "content.edit.own");
  if (!acc.ok) return acc.res;
  try {
    const lesson = (await prisma.lesson.findUnique({ where: { id }, select: { chapter: { select: { teacherId: true } } } }))!;
    if (!canEditChapter(acc.role, acc.session.userId, lesson.chapter.teacherId)) return roleForbidden();

    // Course.lessons là số bài quảng cáo admin tự đặt — không tự đồng bộ theo
    // số Lesson thật (xem ghi chú tương tự ở route tạo bài học).
    await prisma.lesson.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá bài học thất bại" }, { status: 400 });
  }
}
