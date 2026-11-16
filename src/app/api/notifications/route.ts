import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isLinkHidden } from "@/lib/features";

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

  // Rà soát 16/11 (P2): tin có link dẫn vào phần đang ẩn theo cờ (học phí, gói Pro, tìm gia sư, cộng đồng, thi thử công khai, tin tức…) ⇒ trả link null:
  // chuông vẫn hiện chữ nhưng không đưa người bấm vào ngõ cụt (proxy 307 về trang đầu). Lọc LÚC ĐỌC, không sửa dữ liệu: DB giữ link gốc, bật lại cờ là
  // link hiện lại, và lib/notify.ts (tệp KHOÁ) không đổi. Áp cho cả tin cũ lẫn tin mới.
  return NextResponse.json({ notifications: notifications.map(n => (n.link && isLinkHidden(n.link) ? { ...n, link: null } : n)), unreadCount });
}
