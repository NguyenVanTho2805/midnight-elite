import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// POST /api/parent-links — phụ huynh (session hiện tại) gửi yêu cầu liên kết
// tới 1 học viên bằng email. Trạng thái "pending" tới khi học viên tự xác
// nhận (PATCH .../verify) — KHÔNG cấp quyền chỉ từ việc nhập email/SĐT
// (đúng nguyên tắc G2.10).
export async function POST(req: Request) {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const { studentEmail } = await req.json();
  if (!studentEmail?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập email học viên" }, { status: 400 });
  }

  const student = await prisma.user.findUnique({
    where:  { email: studentEmail.trim().toLowerCase() },
    select: { id: true, name: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản học viên với email này" }, { status: 404 });
  }
  if (student.id === session.userId) {
    return NextResponse.json({ error: "Không thể tự liên kết với chính mình" }, { status: 400 });
  }

  const existing = await prisma.parentLink.findUnique({
    where: { parentId_studentId: { parentId: session.userId, studentId: student.id } },
  });
  if (existing) {
    return NextResponse.json({ error: `Yêu cầu liên kết đã tồn tại (trạng thái: ${existing.status})` }, { status: 409 });
  }

  const link = await prisma.parentLink.create({
    data: { parentId: session.userId, studentId: student.id },
  });

  await notify(student.id, {
    type:    "parent_link_request",
    title:   "Yêu cầu liên kết phụ huynh",
    message: `Có một tài khoản yêu cầu liên kết làm phụ huynh của bạn. Vào hồ sơ để xác nhận hoặc từ chối.`,
    link:    `/student/ho-so?parentLink=${link.id}`,
  });

  return NextResponse.json(link, { status: 201 });
}

// GET /api/parent-links — danh sách liên kết của user hiện tại, cả 2 chiều
// (đóng vai phụ huynh và đóng vai học viên).
export async function GET() {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const [asParent, asStudent] = await Promise.all([
    prisma.parentLink.findMany({
      where:   { parentId: session.userId },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.parentLink.findMany({
      where:   { studentId: session.userId },
      include: { parent: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ asParent, asStudent });
}
