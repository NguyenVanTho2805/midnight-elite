import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { triggerSalesBotSync } from "@/lib/salesBotSync";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = await prisma.course.findUnique({
      where: { id },
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
    });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

    const session = await getSession();
    let hasAccess = false;

    if (session) {
      if (session.role === "admin") {
        hasAccess = true;
      } else {
        const enrolled = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: session.userId, courseId: id } },
        });
        hasAccess = !!enrolled;
      }
    }

    // Hidden courses: only admin or enrolled students can access
    if (!course.status && !hasAccess) {
      return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
    }

    // Học viên đã mua/đã enroll (hoặc admin) thì mọi bài học đều mở khoá,
    // bất kể cờ isLocked tĩnh trong DB — isLocked chỉ còn ý nghĩa cho khách chưa mua.
    if (hasAccess) {
      course.sections = course.sections.map(s => ({
        ...s,
        chapters: s.chapters.map(c => ({
          ...c,
          lessons: c.lessons.map(l => ({ ...l, isLocked: false })),
        })),
      }));
    }

    return NextResponse.json(course);
  } catch (e) {
    console.error("[GET /api/courses/[id]]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    const body   = await req.json();

    // Chỉ pick các scalar fields của Course, tránh Unknown argument error khi Prisma client chưa reload
    const data: Record<string, unknown> = {};
    const allowed = [
      "name","adminName","shortTitle","category","instructor","teacherAvatar",
      "openDate","types","tag","tagColor","introVideo","zaloGroupLink","bg","strip",
      "price","originalPrice","lessons","hours","status",
    ];
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const course = await prisma.course.update({ where: { id }, data });
    await triggerSalesBotSync();
    return NextResponse.json(course);
  } catch (e) {
    console.error("[PUT /api/courses/[id]]", e);
    return NextResponse.json({ error: "Cập nhật khóa học thất bại" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    await prisma.course.delete({ where: { id } });
    await triggerSalesBotSync();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/courses/[id]]", e);
    return NextResponse.json({ error: "Xoá khóa học thất bại" }, { status: 400 });
  }
}
