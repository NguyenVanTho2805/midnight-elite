import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// GET /api/admin/sales-leads/[id] — chi tiết 1 lead kèm toàn bộ transcript hội thoại
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(PERMISSIONS.VIEW_SALES_LEADS);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;
  const lead = await prisma.salesLead.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!lead) return NextResponse.json({ error: "Không tìm thấy lead" }, { status: 404 });
  return NextResponse.json(lead);
}
