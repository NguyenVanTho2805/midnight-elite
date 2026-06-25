import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/lesson-notes/[lessonId] — lấy ghi chú cá nhân của học sinh cho bài học
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;
  const note = await prisma.lessonNote.findUnique({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    select: { text: true },
  });

  return NextResponse.json({ text: note?.text ?? "" });
}

// PUT /api/lesson-notes/[lessonId] — lưu (tạo hoặc cập nhật) ghi chú
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { lessonId } = await params;
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string") {
    return NextResponse.json({ error: "Nội dung ghi chú không hợp lệ" }, { status: 400 });
  }

  if (text.trim() === "") {
    await prisma.lessonNote.deleteMany({ where: { userId: session.userId, lessonId } });
    return NextResponse.json({ text: "" });
  }

  const note = await prisma.lessonNote.upsert({
    where:  { userId_lessonId: { userId: session.userId, lessonId } },
    create: { userId: session.userId, lessonId, text },
    update: { text },
    select: { text: true },
  });

  return NextResponse.json(note);
}
