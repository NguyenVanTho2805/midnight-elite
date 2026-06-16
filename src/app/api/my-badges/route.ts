import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/my-badges — trả badgeIds đã được admin trao cho user hiện tại
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 200 });

  const badges = await prisma.userBadge.findMany({
    where:  { userId: session.userId },
    select: { badgeId: true, grantedAt: true },
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json(badges.map(b => b.badgeId));
}
