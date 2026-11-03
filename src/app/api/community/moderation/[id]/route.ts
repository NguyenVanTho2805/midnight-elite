import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { cleanText } from "@/lib/communityRules";
import { communityError, NO_STORE } from "@/lib/communityServer";

// POST /api/community/moderation/[id] { decision: "approve" | "reject", reason? } — duyệt câu hỏi của khách.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  let body: { decision?: unknown; reason?: unknown } = {};
  try { body = await req.json(); } catch { /* thân rỗng → decision_invalid */ }
  const decision = body.decision;
  if (decision !== "approve" && decision !== "reject") return communityError(400, "decision_invalid", "Quyết định phải là approve hoặc reject");
  const reason = cleanText(body.reason, true).slice(0, 300);
  if (decision === "reject" && !reason) return communityError(400, "reject_reason_required", "Cần nêu lý do từ chối");

  const t = await prisma.thread.findUnique({ where: { id }, select: { id: true, status: true, guestName: true, deletedAt: true } });
  if (!t || t.deletedAt || t.guestName === null) return communityError(404, "not_found", "Không tìm thấy câu hỏi");
  if (t.status !== "pending") return communityError(409, "already_decided", "Câu hỏi này đã được xử lý");

  // updateMany có điều kiện status: hai người duyệt cùng lúc chỉ một người thắng.
  const status = decision === "approve" ? "published" : "rejected";
  const res = await prisma.thread.updateMany({
    where: { id, status: "pending", deletedAt: null },
    data: { status, reviewedById: auth.userId, reviewedAt: new Date(), rejectReason: decision === "reject" ? reason : null },
  });
  if (res.count === 0) return communityError(409, "already_decided", "Câu hỏi này đã được xử lý");
  await logAction(auth.userId, decision === "approve" ? "community.guest_question.approve" : "community.guest_question.reject", "thread", id);
  return NextResponse.json({ status }, { headers: NO_STORE });
}
