import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canViewCourseContent, courseTreeForViewer, COURSE_PRIVATE_FIELDS } from "@/lib/lessonAccess";

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

  // "suspended" được xem lại nội dung đã mở (R01) nhưng không mark done/nộp bài mới — route này chỉ trả metadata để render trang, nên cho đọc.
  // "pending_consent" chưa được học — rơi xuống nhánh isFree. Gia sư chỉ có toàn quyền với lớp CỦA MÌNH (xem src/lib/lessonAccess.ts).
  const enrolled = session.role === "admin"
    ? null
    : await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId } } });
  const fullAccess = canViewCourseContent(session, course, enrolled, { includeSuspended: true });

  if (!fullAccess && !lesson.isFree) {
    // Chưa vào lớp (hoặc gia sư của lớp khác) và bài này không phải học thử miễn phí
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }
  // Chưa vào lớp nhưng bài này isFree → cho xem riêng bài này, không mở khoá cả khoá học

  // Chuẩn hoá isLocked cho MỌI bài để giao diện tin cờ này mù quáng:
  // - toàn quyền (học viên đã vào lớp / quản trị / gia sư chủ lớp) → mở khoá hết (bất kể giá trị trong DB);
  // - người khác → bài học thử luôn mở khoá; bài không miễn phí luôn khoá VÀ bị cắt videoUrl / zoomUrl / azotaUrl / documents / adminNote
  //   (trước đây chỉ đặt cờ nên cây bài học của lớp vẫn mang nội dung bài trả phí tới người xem bài học thử — lộ qua DevTools).
  // Gán lại NGAY TRÊN `course`: `lesson.chapter.section.course` cùng là đối tượng này, nên bản `lesson` trả về cũng phải sạch (không cây bài học thứ hai chưa cắt).
  course.sections = courseTreeForViewer(course, fullAccess).sections;
  if (!fullAccess) for (const f of COURSE_PRIVATE_FIELDS) course[f] = null;   // hai link nhóm Zalo của lớp

  return NextResponse.json({ lesson, course, enrolled: fullAccess });
}
