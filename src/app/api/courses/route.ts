import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const allFlag  = searchParams.get("all");  // "1" = admin panel requesting all courses

    const session = await getSession();
    const isAdmin = session?.role === "admin";

    let statusWhere: Record<string, unknown>;

    if (allFlag === "1") {
      // Admin panel requesting all courses — require admin auth
      if (!isAdmin) {
        return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
      }
      statusWhere = {};
    } else {
      // Public access (homepage, catalog, student page):
      // Always show only active courses.
      // Exception: enrolled students also see courses they paid for, even if hidden.
      if (session?.role === "student") {
        const enrollments = await prisma.enrollment.findMany({
          where:  { userId: session.userId },
          select: { courseId: true },
        });
        const enrolledIds = enrollments.map(e => e.courseId);
        statusWhere = enrolledIds.length > 0
          ? { OR: [{ status: true }, { id: { in: enrolledIds } }] }
          : { status: true };
      } else {
        statusWhere = { status: true };
      }
    }

    const courses = await prisma.course.findMany({
      where: { ...(category ? { category } : {}), ...statusWhere },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(courses);
  } catch (e) {
    console.error("[GET /api/courses]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();
    const allowed = [
      "id","adminId","name","adminName","shortTitle","category","instructor",
      "teacherAvatar","openDate","types","tag","tagColor","bg","strip",
      "introVideo","price","originalPrice","lessons","hours","status",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (!data.name || !data.id) {
      return NextResponse.json({ error: "Thiếu id hoặc name" }, { status: 400 });
    }
    // createdAt do server sinh ra — không tin giá trị từ client
    data.createdAt = new Date().toLocaleDateString("vi-VN") + " 08:00:00";
    const course = await prisma.course.create({ data: data as Parameters<typeof prisma.course.create>[0]["data"] });
    return NextResponse.json(course, { status: 201 });
  } catch (e) {
    console.error("[POST /api/courses]", e);
    return NextResponse.json({ error: "Failed to create course" }, { status: 400 });
  }
}
