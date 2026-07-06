import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST /api/favorites/[courseId] — bật/tắt yêu thích khóa học
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { courseId } = await params;

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

    const existing = await prisma.courseFavorite.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });

    if (existing) {
      await prisma.courseFavorite.delete({ where: { userId_courseId: { userId: session.userId, courseId } } });
    } else {
      await prisma.courseFavorite.create({ data: { userId: session.userId, courseId } });
    }

    return NextResponse.json({ favorited: !existing });
  } catch (e) {
    console.error("[POST /api/favorites/:courseId]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
