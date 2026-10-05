import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { notify } from "@/lib/notify";
import { requireCenterAdmin, PENDING_TUTOR_WHERE } from "@/lib/tutorApplicationGuard";

// POST /api/admin/tutor-applications/[userId]/approve (BE-052)
// Chuyển đơn đang chờ thành gia sư: role "admin" + adminRole "teacher" +
// tutorVerified. updateMany có điều kiện "đang chờ" → 2 admin duyệt cùng
// lúc chỉ 1 người thành công, người kia 409.
// Bắt buộc email đã xác thực — tránh người nộp đơn bằng email không phải
// của mình rồi được cấp quyền gia sư dưới danh tính người khác.
// Gia sư cần đăng nhập lại để JWT mang adminRole mới.
// logAction("tutor.approve") chưa gắn — AuditLog chưa có trên main (BE-082/085).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { userId } = await params;

  const flipped = await prisma.user.updateMany({
    where: { id: userId, ...PENDING_TUTOR_WHERE, emailVerified: true },
    data: {
      role:            "admin",
      adminRole:       "teacher",
      tutorVerified:   true,
      tutorVerifiedAt: new Date(),
      tutorVerifiedBy: auth.userId,
    },
  });
  if (flipped.count === 0) {
    const pending = await prisma.user.findFirst({
      where:  { id: userId, ...PENDING_TUTOR_WHERE },
      select: { emailVerified: true },
    });
    if (pending && !pending.emailVerified) {
      return NextResponse.json({ error: "Người nộp đơn chưa xác thực email" }, { status: 409 });
    }
    const exists = pending ?? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    return NextResponse.json({ error: "Không có đơn gia sư đang chờ duyệt" }, { status: 409 });
  }

  await notify(userId, {
    type:    "tutor_approved",
    title:   "Hồ sơ gia sư đã được duyệt",
    message: "Bạn đã là gia sư trên KiN. Đăng nhập lại để bắt đầu tạo lớp.",
    link:    "/admin",
  });

  return NextResponse.json({ success: true });
}
