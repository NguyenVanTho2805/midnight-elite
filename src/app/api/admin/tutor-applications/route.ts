import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin, PENDING_TUTOR_WHERE } from "@/lib/tutorApplicationGuard";

// GET /api/admin/tutor-applications?status=pending|approved|rejected (BE-051)
// Mặc định pending. Chỉ admin_super/admin_content.
export async function GET(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  let where: object;
  if (status === "pending")       where = PENDING_TUTOR_WHERE;
  else if (status === "approved") where = { tutorVerified: true };
  else if (status === "rejected") where = { tutorAppliedAt: { not: null }, tutorVerified: false, tutorRejectedAt: { not: null } };
  else return NextResponse.json({ error: "status phải là pending | approved | rejected" }, { status: 400 });

  const applications = await prisma.user.findMany({
    where,
    orderBy: { tutorAppliedAt: "asc" },
    select: {
      id: true, name: true, email: true, phone: true, city: true, emailVerified: true,
      bio: true, subjects: true, tutorAppliedAt: true,
      tutorVerifiedAt: true, tutorRejectedAt: true, tutorRejectReason: true,
    },
  });
  return NextResponse.json({ applications });
}
