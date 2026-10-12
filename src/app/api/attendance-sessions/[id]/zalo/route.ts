// TT-199 giai đoạn 1 — ghi "Đã mở Zalo lúc …" khi gia sư mở Zalo để nhắn phụ huynh về buổi điểm danh này.
// KiN chỉ biết gia sư ĐÃ MỞ Zalo, không biết tin có đi thật hay không → không bao giờ ghi "đã gửi".
//   POST { userId } — chỉ khi em đã được điểm danh ở buổi này.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const session = await prisma.attendanceSession.findUnique({ where: { id }, select: { courseId: true } });
  if (!session) return NextResponse.json({ error: "Không tìm thấy buổi" }, { status: 404 });
  const course = await prisma.course.findUnique({ where: { id: session.courseId }, select: { ownerId: true } });
  if (!course) return NextResponse.json({ error: "Lớp không còn tồn tại" }, { status: 404 });
  if (!ownsResource(auth, course.ownerId)) return NextResponse.json({ error: "Bạn không có quyền với lớp này" }, { status: 403 });

  const body = await req.json().catch(() => null) as { userId?: unknown } | null;
  if (typeof body?.userId !== "string" || !body.userId) return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  const now = new Date();
  const r = await prisma.attendanceRecord.updateMany({ where: { sessionId: id, userId: body.userId }, data: { zaloOpenedAt: now } });
  if (r.count === 0) return NextResponse.json({ error: "Em này chưa được điểm danh ở buổi này — lưu điểm danh trước" }, { status: 409 });
  return NextResponse.json({ ok: true, openedAt: now.toISOString() });
}
