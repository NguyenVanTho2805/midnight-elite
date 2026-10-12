// PH-212 — báo cáo hồ sơ gia sư (đòi chuyển khoản trước buổi thử, hồ sơ giả, lớp ảo). Ai cũng gửi được, không cần tài khoản.
// Giới hạn theo IP để không bị dùng làm công cụ quấy rối; quản trị xem ở /admin/pheu.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, limitOrBlock } from "@/lib/rate-limit";
import { REPORT_DETAIL_MAX, isReportReason, normalizeChannel } from "@/lib/funnel";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "profile-report", 5, 60 * 60_000) ?? limitOrBlock(`${ip}:${id}`, "profile-report-one", 2, 24 * 60 * 60_000);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null) as { reason?: unknown; detail?: unknown; n?: unknown } | null;
  if (!isReportReason(body?.reason)) return NextResponse.json({ error: "Hãy chọn lý do báo cáo" }, { status: 400 });
  const detailRaw = typeof body?.detail === "string" ? body.detail.trim() : "";
  if (body?.detail !== undefined && body.detail !== null && typeof body.detail !== "string") return NextResponse.json({ error: "Chi tiết phải là chữ" }, { status: 400 });
  if (detailRaw.length > REPORT_DETAIL_MAX) return NextResponse.json({ error: `Chi tiết tối đa ${REPORT_DETAIL_MAX} ký tự` }, { status: 400 });
  if (body.reason === "khac" && !detailRaw) return NextResponse.json({ error: "Hãy mô tả ngắn lý do" }, { status: 400 });
  const tutor = await prisma.user.findFirst({ where: { id, role: "admin", adminRole: "teacher", banned: false }, select: { id: true } });
  if (!tutor) return NextResponse.json({ error: "Không tìm thấy gia sư" }, { status: 404 });
  await prisma.tutorProfileReport.create({ data: { tutorId: id, reason: body.reason, detail: detailRaw || null, channel: body.n === undefined ? null : normalizeChannel(body.n) } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
