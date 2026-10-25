import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isCourseManager, lessonFor, type MediaContext, canViewAllMaterials, redactCourseLinks } from "@/lib/mediaAccess";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;

  // 1 query thay vì 4 queries liên tiếp
  const lesson = await prisma.lesson.findUnique({
    where:   { id },
    include: {
      chapter: {
        include: {
          section: {
            include: {
              course: {
                include: {
                  sections: {
                    orderBy: { order: "asc" },
                    include: {
                      chapters: {
                        orderBy: { order: "asc" },
                        include: { lessons: { orderBy: { order: "asc" } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!lesson) return NextResponse.json({ error: "Không tìm thấy bài học" }, { status: 404 });

  const course   = lesson.chapter.section.course;
  const courseId = course.id;

  const viewer = { userId: session.userId, role: session.role, adminRole: session.adminRole };
  // MD-03: gia sư chỉ là "quản lý" với lớp của chính mình; lớp người khác đối xử như người ngoài (chỉ bài miễn phí).
  let fullAccess = isCourseManager(viewer, course.ownerId);
  let enrolled: { status: string } | null = null;

  if (!fullAccess) {
    enrolled = session.role === "student"
      ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } } })
      : null;
    // "suspended" được xem lại nội dung đã mở (R01) nhưng không mark done/nộp
    // bài mới — route này chỉ trả metadata để render trang, nên cho đọc.
    // "pending_consent" chưa được học — rơi xuống nhánh isFree.
    if (enrolled && (enrolled.status === "active" || enrolled.status === "suspended")) {
      fullAccess = true;
    } else if (!lesson.isFree) {
      // Chưa enroll và bài này không phải học thử miễn phí
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }
    // Chưa enroll nhưng bài này isFree → cho xem riêng bài này, không mở khoá cả khoá học
  }

  // Normalise isLocked for every lesson so the frontend can trust this flag blindly:
  // - enrolled/admin → all unlocked (regardless of DB value)
  // - not enrolled   → locked iff not free (regardless of DB value)
  // This prevents admins forgetting to set isLocked=true from leaking paid content.
  // MD-03: ngoài isLocked, mọi bài trong cây mà người xem chưa được mở thì bị bỏ link (trước đây người xem MỘT bài miễn phí nhận
  // luôn videoUrl/documents/azotaUrl của cả khoá). "suspended" vẫn được xem lại bài đã mở theo quy tắc R01 nên coi như có quyền ở đây.
  const ctx: MediaContext = { viewer, courseOwnerId: course.ownerId, enrollment: fullAccess ? { status: "active" } : enrolled };
  // Link nhóm Zalo (zaloGroupLink, zaloGroupUrl) và link học online (classJoinUrl) của lớp chỉ dành cho quản lý lớp và học viên ĐANG HỌC (kể cả khi xem lại bài ở trạng thái
  // tạm ngưng: được xem nội dung đã mở nhưng không cần link nhóm). `course` cũng chính là lesson.chapter.section.course (cùng một đối tượng) nên sửa tại chỗ.
  if (!canViewAllMaterials({ viewer, courseOwnerId: course.ownerId, enrollment: enrolled })) Object.assign(course, redactCourseLinks(course));
  course.sections = course.sections.map(s => ({
    ...s,
    chapters: s.chapters.map(c => ({
      ...c,
      lessons: c.lessons.map(l => ({
        ...lessonFor(ctx, l),
        isLocked: fullAccess ? false : !l.isFree,
      })),
    })),
  }));

  return NextResponse.json({ lesson: lessonFor(ctx, lesson), course, enrolled: fullAccess });
}
