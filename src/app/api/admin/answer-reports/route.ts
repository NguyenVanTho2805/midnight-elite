import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// GET /api/admin/answer-reports — danh sách report đang chờ duyệt
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const reports = await prisma.answerReport.findMany({
    where:   { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      reporter: { select: { id: true, name: true } },
      answer: {
        select: {
          id: true, content: true, rewardPaid: true,
          author:   { select: { id: true, name: true } },
          question: { select: { id: true, title: true } },
        },
      },
    },
  });

  return NextResponse.json(reports);
}
