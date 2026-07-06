import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/favorites — danh sách courseId mà student hiện tại đã yêu thích
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ courseIds: [] });

    const rows = await prisma.courseFavorite.findMany({
      where:  { userId: session.userId },
      select: { courseId: true },
    });

    return NextResponse.json({ courseIds: rows.map(r => r.courseId) });
  } catch (e) {
    console.error("[GET /api/favorites]", e);
    return NextResponse.json({ courseIds: [] });
  }
}
