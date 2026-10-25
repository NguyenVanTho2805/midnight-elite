// KiN Pro F6 — hàng đợi hỗ trợ cho quản trị (MANAGE_TUTORS). Xếp: đang chờ trước; trong đó khẩn → Pro ("Ưu tiên") → thường, cũ nhất trước.
// Có tên và email gia sư (đúng việc: để trả lời). Không có dữ liệu học sinh vì form không thu.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { KIND_LABEL, STATUS_LABEL, isSupportKind, laneOf, sortQueue, type SupportStatus } from "@/lib/supportDesk";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_TUTORS);
  if (isNextResponse(auth)) return auth;
  const rows = await prisma.supportRequest.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { name: true, email: true } } } });
  const sorted = sortQueue(rows);
  return NextResponse.json({
    openCount: rows.filter(r => r.status === "open").length,
    requests: sorted.map(r => ({
      id: r.id, userName: r.user.name, userEmail: r.user.email, kind: r.kind, kindLabel: isSupportKind(r.kind) ? KIND_LABEL[r.kind] : r.kind, subject: r.subject, message: r.message,
      lane: laneOf(isSupportKind(r.kind) ? r.kind : "other", r.planAtSend === "pro" ? "pro" : "free"), planAtSend: r.planAtSend,
      status: r.status, statusLabel: STATUS_LABEL[r.status as SupportStatus] ?? r.status, reply: r.reply, repliedAt: r.repliedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
