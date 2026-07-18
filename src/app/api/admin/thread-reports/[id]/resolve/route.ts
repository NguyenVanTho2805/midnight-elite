import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// POST /api/admin/thread-reports/[id]/resolve — admin duyệt report: { decision: "approved" | "rejected" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const { decision } = await req.json();
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision phải là 'approved' hoặc 'rejected'" }, { status: 400 });
  }

  const report = await prisma.threadReport.findUnique({ where: { id }, select: { status: true, threadId: true } });
  if (!report) return NextResponse.json({ error: "Không tìm thấy report" }, { status: 404 });
  if (report.status !== "pending") return NextResponse.json({ error: "Report này đã được xử lý" }, { status: 409 });

  await prisma.threadReport.update({ where: { id }, data: { status: decision } });

  if (decision === "approved") {
    // Soft-delete bài viết vi phạm — không xoá cứng, giữ lại bằng chứng
    await prisma.thread.update({ where: { id: report.threadId }, data: { deletedAt: new Date() } });
  }

  return NextResponse.json({ success: true });
}
