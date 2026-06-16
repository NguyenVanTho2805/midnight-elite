import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/enrollments — danh sách courseId mà student hiện tại đã enroll
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ courseIds: [] });

  const rows = await prisma.enrollment.findMany({
    where:  { userId: session.userId },
    select: { courseId: true },
  });

  return NextResponse.json({ courseIds: rows.map(r => r.courseId) });
}
