import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const guard = await requirePermission(PERMISSIONS.MANAGE_COURSES);
  if (isNextResponse(guard)) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const reviews = await prisma.courseReview.findMany({
    where: status === "all" ? {} : { status },
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ reviews });
}
