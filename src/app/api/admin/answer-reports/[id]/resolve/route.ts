import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addCoins } from "@/lib/wallet";
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

  await prisma.answerReport.update({ where: { id }, data: { status: decision } });

  if (decision === "approved" && !report.answer.isPenalized) {
    await prisma.answer.update({ where: { id: report.answer.id }, data: { isPenalized: true } });

    // Chỉ trừ xu nếu câu trả lời đã từng được chấp nhận và nhận thưởng
    if (report.answer.rewardPaid) {
      await addCoins(report.answer.authorId, -report.answer.rewardPaid, "report_penalty", report.answer.id);
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
