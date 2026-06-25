import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/[id]/read — đánh dấu 1 thông báo là đã đọc
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;

  const updated = await prisma.notification.updateMany({
    where: { id, userId: session.userId },
    data:  { isRead: true },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
  return NextResponse.json({ success: true });
}
