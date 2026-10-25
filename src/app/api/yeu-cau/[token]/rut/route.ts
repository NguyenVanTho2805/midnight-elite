// PH-07 — khách RÚT yêu cầu của mình: đóng yêu cầu, xoá số liên hệ / tên / ghi chú, thu hồi dòng đồng ý. Chỉ khi gia sư chưa phản hồi.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/auditLog";
import { isTrackToken } from "@/lib/tutorRequest";
import { SCRUB } from "@/lib/tutorRequestServer";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`yeu-cau-rut:${getClientIp(req)}`, 20, 60_000)) return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." }, { status: 429 });
  const { token } = await params;
  if (!isTrackToken(token)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  const r = await prisma.tutorRequest.findUnique({ where: { trackToken: token }, select: { id: true, status: true } });
  if (!r) return NextResponse.json({ error: "Mã không hợp lệ hoặc yêu cầu không còn" }, { status: 404 });
  if (r.status !== "new") return NextResponse.json({ error: "Yêu cầu này đã có phản hồi hoặc đã đóng nên không rút được nữa." }, { status: 409 });
  const now = new Date();
  const done = await prisma.$transaction(async tx => {
    const u = await tx.tutorRequest.updateMany({ where: { id: r.id, status: "new" }, data: { status: "closed", decidedAt: now, ...SCRUB } });
    if (u.count === 0) return false;
    await tx.consentRecord.updateMany({ where: { subjectType: "tutor_request", subjectId: r.id, revokedAt: null }, data: { revokedAt: now, revokeCause: "guardian_request" } });
    return true;
  });
  if (!done) return NextResponse.json({ error: "Yêu cầu này vừa có phản hồi nên không rút được nữa." }, { status: 409 });
  await logAction(null, "tutor_request.withdraw", "TutorRequest", r.id, {});
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
