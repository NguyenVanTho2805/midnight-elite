// PH-212 — xử lý một báo cáo hồ sơ gia sư.
//   PATCH { action: "dismiss" }                → bỏ qua báo cáo này (không có căn cứ)
//   PATCH { action: "lock", reason }           → khoá hồ sơ công khai của gia sư + đóng MỌI báo cáo đang mở về gia sư đó
// Khoá chỉ ẩn hồ sơ công khai (404); gia sư vẫn dùng sổ lớp. Mở khoá: DELETE /api/admin/profile-lock/[tutorId].
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const rep = await prisma.tutorProfileReport.findUnique({ where: { id } });
  if (!rep) return NextResponse.json({ error: "Không tìm thấy báo cáo" }, { status: 404 });
  const body = await req.json().catch(() => null) as { action?: unknown; reason?: unknown } | null;
  const now = new Date();

  if (body?.action === "dismiss") {
    const r = await prisma.tutorProfileReport.updateMany({ where: { id, status: "open" }, data: { status: "resolved", resolution: "dismissed", resolvedAt: now, resolvedBy: auth.userId } });
    if (r.count === 0) return NextResponse.json({ ok: true, alreadyResolved: true });
    await logAction(auth.userId, "profile_report.dismiss", "TutorProfileReport", id, { tutorId: rep.tutorId });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "lock") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "Hãy ghi lý do khoá hồ sơ" }, { status: 400 });
    if (reason.length > 500) return NextResponse.json({ error: "Lý do tối đa 500 ký tự" }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: rep.tutorId }, data: { profileLockedAt: now, profileLockReason: reason } }),
      prisma.tutorProfileReport.updateMany({ where: { tutorId: rep.tutorId, status: "open" }, data: { status: "resolved", resolution: "locked", resolvedAt: now, resolvedBy: auth.userId } }),
    ]);
    await logAction(auth.userId, "profile_report.lock", "User", rep.tutorId, { reportId: id, reason });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action phải là dismiss hoặc lock" }, { status: 400 });
}
