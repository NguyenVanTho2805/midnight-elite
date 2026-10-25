// PH-07 — trang THEO DÕI yêu cầu của khách (không cần đăng nhập, vào bằng mã trong link). GET: trạng thái + chính những gì khách đã gửi (trừ số liên hệ).
// Không trả số điện thoại, ghi chú, tên liên hệ, hay bất cứ gì của gia sư ngoài tên công khai.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { LEVEL_LABEL, PARENT_STATUS_TEXT, isRequestLevel, isTrackToken, type RequestStatus } from "@/lib/tutorRequest";
import { expireOldRequests } from "@/lib/tutorRequestServer";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`yeu-cau-xem:${getClientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." }, { status: 429 });
  const { token } = await params;
  if (!isTrackToken(token)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  await expireOldRequests();
  const r = await prisma.tutorRequest.findUnique({
    where: { trackToken: token },
    select: { status: true, level: true, subject: true, mode: true, slots: true, createdAt: true, decidedAt: true, target: { select: { id: true, name: true } } },
  });
  if (!r) return NextResponse.json({ error: "Mã không hợp lệ hoặc yêu cầu không còn" }, { status: 404 });
  const status = r.status as RequestStatus;
  const text = PARENT_STATUS_TEXT[status] ?? PARENT_STATUS_TEXT.closed;
  return NextResponse.json({
    status, title: text.title, detail: text.detail, canWithdraw: status === "new",
    request: { level: isRequestLevel(r.level) ? LEVEL_LABEL[r.level] : r.level, subject: r.subject, mode: r.mode, slots: r.slots, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null },
    tutor: r.target ? { id: r.target.id, name: r.target.name } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
