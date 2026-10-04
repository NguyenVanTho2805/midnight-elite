import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addCoins } from "@/lib/wallet";
import { COIN_REASONS } from "@/lib/wallet-constants";
import { notify } from "@/lib/notify";

// POST /api/admin/answer-reports/[id]/resolve — admin duyệt report: { decision: "approved" | "rejected" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const { decision } = await req.json();
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision phải là 'approved' hoặc 'rejected'" }, { status: 400 });
  }

  const report = await prisma.answerReport.findUnique({
    where:   { id },
    include: { answer: { select: { id: true, authorId: true, rewardPaid: true, isPenalized: true, questionId: true } } },
  });
  if (!report) return NextResponse.json({ error: "Không tìm thấy report" }, { status: 404 });
  if (report.status !== "pending") return NextResponse.json({ error: "Report này đã được xử lý" }, { status: 409 });

  // Flip report status atomically: 2 admin resolve đồng thời chỉ có 1 cái
  // qua được count=1. Cái thua count=0 bail → tránh addCoins(-rewardPaid)
  // chạy 2 lần (phạt kép) khi quyết định là approved.
  const flipped = await prisma.answerReport.updateMany({
    where: { id, status: "pending" },
    data:  { status: decision },
  });
  if (flipped.count === 0) {
    return NextResponse.json({ error: "Report này đã được xử lý" }, { status: 409 });
  }

  if (decision === "approved") {
    // Flip isPenalized atomically — nếu đã bị phạt rồi (do report trước đó
    // trên cùng answer đã approved), count=0 → không trừ xu lần 2 và không
    // notify. Thay guard "!report.answer.isPenalized" đọc stale.
    const penalized = await prisma.answer.updateMany({
      where: { id: report.answer.id, isPenalized: false },
      data:  { isPenalized: true },
    });
    if (penalized.count === 0) {
      return NextResponse.json({ success: true });
    }

    // Chỉ trừ xu nếu câu trả lời đã từng được chấp nhận và nhận thưởng
    if (report.answer.rewardPaid) {
      await addCoins(report.answer.authorId, -report.answer.rewardPaid, COIN_REASONS.REPORT_PENALTY, report.answer.id);
    }

    await notify(report.answer.authorId, {
      type:    "report_penalty",
      title:   "Câu trả lời bị báo cáo",
      message: report.answer.rewardPaid
        ? `Câu trả lời của bạn bị xác nhận vi phạm, bạn bị trừ ${report.answer.rewardPaid} xu`
        : `Câu trả lời của bạn bị xác nhận vi phạm chất lượng`,
      link:    `/student/hoi-dap/${report.answer.questionId}`,
    });
  }

  return NextResponse.json({ success: true });
}
