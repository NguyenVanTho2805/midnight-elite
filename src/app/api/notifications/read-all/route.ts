import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/read-all — đánh dấu tất cả thông báo của user là đã đọc
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.userId, isRead: false },
    data:  { isRead: true },
  });

  return NextResponse.json({ success: true });
}
