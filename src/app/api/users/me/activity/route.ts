import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";

export async function GET() {
  const session = await requireSession();
  if (isNextResponse(session)) return session;

  const since = new Date();
  since.setDate(since.getDate() - 59);

  const progress = await prisma.lessonProgress.findMany({
    where: { userId: session.userId, completedAt: { gte: since } },
    select: { completedAt: true },
  });

  const counts: Record<string, number> = {};
  for (const p of progress) {
    const day = new Date(p.completedAt).toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
