import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/admin/sales-leads — danh sách lead/hội thoại tư vấn từ TSIX Sales Bot.
// Dữ liệu được Python service ghi trực tiếp qua psycopg2 (xem
// tsix-sales-bot/app/core/lead_persistence.py), không qua Prisma Client khi ghi.
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.VIEW_SALES_LEADS);
  if (isNextResponse(auth)) return auth;

  const leads = await prisma.salesLead.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(leads);
}
