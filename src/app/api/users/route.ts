import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_ADMINS);
  if (isNextResponse(auth)) return auth;

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, adminRole: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
