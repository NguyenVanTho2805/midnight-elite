import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/followed-courses — danh sách lớp học viên đang theo dõi (BE-079).
// Bảng vẫn là cart_items (xem comment model CartItem trong schema).
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ items: [] });

    const items = await prisma.cartItem.findMany({
      where: { userId: session.userId },
      include: {
        course: {
          select: {
            id: true, name: true, category: true, bg: true, instructor: true,
            lessons: true, hours: true, status: true, classStatus: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/followed-courses]", e);
    return NextResponse.json({ items: [] });
  }
}
