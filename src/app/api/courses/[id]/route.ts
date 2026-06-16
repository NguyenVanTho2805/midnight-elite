import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

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
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // Hidden courses: only admin or enrolled students can access
    if (!course.status) {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Course not found" }, { status: 404 });

      if (session.role === "admin") {
        return NextResponse.json(course);
      }

      // Check if student is enrolled
      const enrolled = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId: id } },
      });
      if (!enrolled) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (e) {
    console.error("[GET /api/courses/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      "openDate","types","tag","tagColor","introVideo","bg","strip",
      "price","originalPrice","lessons","hours","status",
    ];
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const course = await prisma.course.update({ where: { id }, data });
    return NextResponse.json(course);
  } catch (e) {
    console.error("[PUT /api/courses/[id]]", e);
    return NextResponse.json({ error: "Failed to update course" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const { id } = await params;
    await prisma.course.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/courses/[id]]", e);
    return NextResponse.json({ error: "Failed to delete course" }, { status: 400 });
  }
}
