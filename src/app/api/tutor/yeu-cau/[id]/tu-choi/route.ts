// KH-04 — gia sư TỪ CHỐI yêu cầu (chưa sắp xếp được lớp). Xoá số liên hệ / tên / ghi chú khỏi yêu cầu, thu hồi dòng đồng ý; khách thấy trạng thái trên trang theo dõi.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { SCRUB } from "@/lib/tutorRequestServer";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.tutorRequest.findUnique({ where: { id }, select: { id: true, targetTutorId: true, status: true } });
  if (!r) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  if (r.targetTutorId !== auth.userId) return NextResponse.json({ error: "Yêu cầu này không gửi tới bạn" }, { status: 403 });
  if (r.status !== "new") return NextResponse.json({ error: "Yêu cầu này đã được xử lý hoặc đã đóng" }, { status: 409 });
  const now = new Date();
  await prisma.$transaction([
    prisma.tutorRequest.update({ where: { id }, data: { status: "declined", decidedAt: now, ...SCRUB } }),
    prisma.consentRecord.updateMany({ where: { subjectType: "tutor_request", subjectId: id, revokedAt: null }, data: { revokedAt: now, revokedById: auth.userId, revokeCause: "request_declined" } }),
  ]);
  await logAction(auth.userId, "tutor_request.decline", "TutorRequest", id, {});
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
