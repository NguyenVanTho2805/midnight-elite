import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — 30 thông báo gần nhất của user hiện tại + số chưa đọc
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ notifications: [], unreadCount: 0 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where:   { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take:    30,
    }),
    prisma.notification.count({
      where: { userId: session.userId, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
