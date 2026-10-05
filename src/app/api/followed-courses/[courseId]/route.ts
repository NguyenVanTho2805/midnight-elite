import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST/DELETE /api/followed-courses/[courseId] — theo dõi / bỏ theo dõi 1 lớp.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { courseId } = await params;
  try {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });
    if (enrolled) return NextResponse.json({ error: "Bạn đã là học viên của lớp này" }, { status: 409 });

    await prisma.cartItem.upsert({
      where:  { userId_courseId: { userId: session.userId, courseId } },
      create: { userId: session.userId, courseId },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/followed-courses/:courseId]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { courseId } = await params;
  try {
    // deleteMany: bỏ theo dõi lớp chưa từng theo dõi vẫn trả ok (idempotent),
    // thay vì nuốt mọi lỗi DB thành 404.
    await prisma.cartItem.deleteMany({ where: { userId: session.userId, courseId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/followed-courses/:courseId]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
