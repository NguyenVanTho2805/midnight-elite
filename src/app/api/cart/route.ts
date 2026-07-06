import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ items: [] });

    const items = await prisma.cartItem.findMany({
      where: { userId: session.userId },
      include: {
        course: {
          select: {
            id: true, name: true, category: true, price: true,
            originalPrice: true, bg: true, instructor: true,
            lessons: true, hours: true, status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET /api/cart]", e);
    return NextResponse.json({ items: [] });
  }
}
