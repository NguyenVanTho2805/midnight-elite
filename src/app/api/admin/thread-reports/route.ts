import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// GET /api/admin/thread-reports — danh sách report bài viết cộng đồng đang chờ duyệt
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_COMMUNITY);
  if (isNextResponse(auth)) return auth;

  const reports = await prisma.threadReport.findMany({
    where:   { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      reporter: { select: { id: true, name: true } },
      thread: {
        select: {
          id: true, content: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(reports);
}
