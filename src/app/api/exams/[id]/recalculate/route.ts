import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";

// POST /api/exams/[id]/recalculate — đồng bộ lại exam.participants từ DB thật
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  const { id } = await params;

  const exam = await prisma.$transaction(async (tx) => {
    const actual = await tx.examResult.count({ where: { examId: id } });
    return tx.exam.update({
      where: { id },
      data:  { participants: actual },
      select: { id: true, participants: true },
    });
  });

  return NextResponse.json({ id: exam.id, participants: exam.participants, recalculated: true });
}
