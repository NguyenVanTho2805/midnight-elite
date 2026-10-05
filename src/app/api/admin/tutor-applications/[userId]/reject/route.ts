import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";
import { requireCenterAdmin, PENDING_TUTOR_WHERE } from "@/lib/tutorApplicationGuard";

const REASON_MAX = 500;

// POST /api/admin/tutor-applications/[userId]/reject  { reason } (BE-053)
// Từ chối đơn đang chờ, bắt buộc lý do. Tài khoản vẫn là học viên bình
// thường, không bị khoá. Nộp lại đơn: chưa làm (chờ chốt C1.3).
// BE-085: ghi audit tutor.reject (AuditLog đã có trên main sau PR #14).
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { userId } = await params;

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "Vui lòng nêu lý do từ chối" }, { status: 400 });
  if (reason.length > REASON_MAX) {
    return NextResponse.json({ error: `Lý do tối đa ${REASON_MAX} ký tự` }, { status: 400 });
  }

  const flipped = await prisma.user.updateMany({
    where: { id: userId, ...PENDING_TUTOR_WHERE },
    data:  { tutorRejectedAt: new Date(), tutorRejectReason: reason },
  });
  if (flipped.count === 0) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    return NextResponse.json({ error: "Không có đơn gia sư đang chờ duyệt" }, { status: 409 });
  }

  await logAction(auth.userId, "tutor.reject", "User", userId, { reason });

  await notify(userId, {
    type:    "tutor_rejected",
    title:   "Hồ sơ gia sư chưa được duyệt",
    message: `Lý do: ${reason}`,
    link:    "/student/ho-so",
  });

  return NextResponse.json({ success: true });
}
