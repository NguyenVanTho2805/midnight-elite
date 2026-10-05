import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse, ownsResource } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/exams/[id]/guest-access — admin: danh sách guest đã được duyệt phí
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  const grants = await prisma.examGuestAccess.findMany({
    where: { examId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { grantedAt: "desc" },
  });
  return NextResponse.json(grants);
}

// POST /api/exams/[id]/guest-access — admin: duyệt quyền thi cho 1 user
// (BE-080 chốt 06/10/2026: giữ nguyên model + 3 route; khách BẮT BUỘC
// đăng ký tài khoản trước mới cấp được guest-access vì ExamGuestAccess
// gắn vào userId của tài khoản thật — không có "khách ẩn danh làm bài").
//
// Luồng gửi đề cho khách hàng dùng thử:
//   1. Gia sư gửi link `/dang-ky?then=/thi-thu/<examId>` cho khách.
//   2. Khách đăng ký tài khoản.
//   3. Khách báo email đã đăng ký cho gia sư.
//   4. Gia sư gọi route này với email đó → cấp guest-access.
//   5. Khách vào `/thi-thu/<examId>` làm bài.
// Admin cấp quyền trước khi khách đăng ký không được — email chưa tồn tại
// trả 404 kèm hướng dẫn.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id: examId } = await params;

  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { ownerId: true } });
  if (!exam) return NextResponse.json({ error: "Không tìm thấy đề thi" }, { status: 404 });
  if (!ownsResource(auth, exam.ownerId)) {
    return NextResponse.json({ error: "Bạn không có quyền với đề thi này" }, { status: 403 });
  }

  try {
    const { email } = await req.json() as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Thiếu email học viên/guest" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!targetUser) {
      // BE-080: không auto-tạo tài khoản — khách phải tự đăng ký để kiểm
      // soát danh tính + bảo mật mật khẩu. Thông điệp hướng dẫn gia sư.
      return NextResponse.json(
        { error: `Email ${email.trim()} chưa đăng ký tài khoản — bảo khách đăng ký tại /dang-ky trước, sau đó mới duyệt được.` },
        { status: 404 },
      );
    }
    if (targetUser.banned) {
      return NextResponse.json({ error: "Tài khoản này đã bị khóa" }, { status: 409 });
    }

    const grant = await prisma.examGuestAccess.upsert({
      where: { userId_examId: { userId: targetUser.id, examId } },
      create: { userId: targetUser.id, examId, grantedBy: auth.userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(grant, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams/[id]/guest-access]", e);
    return NextResponse.json({ error: "Duyệt phí thất bại" }, { status: 400 });
  }
}
