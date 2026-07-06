import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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
    if (enrolled) return NextResponse.json({ error: "Bạn đã đăng ký khóa học này rồi" }, { status: 409 });

    await prisma.cartItem.upsert({
      where:  { userId_courseId: { userId: session.userId, courseId } },
      create: { userId: session.userId, courseId },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/cart/:courseId]", e);
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
    await prisma.cartItem.delete({
      where: { userId_courseId: { userId: session.userId, courseId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
}
