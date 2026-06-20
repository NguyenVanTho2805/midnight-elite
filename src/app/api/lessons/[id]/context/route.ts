import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const course   = lesson.chapter.section.course;
  const courseId = course.id;

  let fullAccess = session.role === "admin";

  if (!fullAccess) {
    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });
    if (enrolled) {
      fullAccess = true;
    } else if (!lesson.isFree) {
      // Chưa enroll và bài này không phải học thử miễn phí
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }
    // Chưa enroll nhưng bài này isFree → cho xem riêng bài này, không mở khoá cả khoá học
  }

  if (fullAccess) {
    // Đã enroll/admin — mọi bài học đều mở khoá, bất kể cờ isLocked tĩnh trong DB.
    course.sections = course.sections.map(s => ({
      ...s,
      chapters: s.chapters.map(c => ({
        ...c,
        lessons: c.lessons.map(l => ({ ...l, isLocked: false })),
      })),
    }));
  }

  return NextResponse.json({ lesson, course });
}
