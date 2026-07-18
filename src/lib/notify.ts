import { prisma } from "@/lib/prisma";

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  link?: string;
};

// Tạo thông báo cho 1 user. Cố ý nuốt lỗi — thông báo là tính năng phụ trợ,
// không bao giờ được làm hỏng hành động chính (enroll, reply, like...).
export async function notify(userId: string, data: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, ...data } });
  } catch (e) {
    console.error("[notify] Không tạo được thông báo:", e);
  }
}

// Tạo thông báo cho nhiều user cùng lúc (vd broadcast bài viết mới, đề thi mới).
export async function notifyMany(userIds: string[], data: NotificationInput): Promise<void> {
  if (!userIds.length) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map(userId => ({ userId, ...data })),
    });
  } catch (e) {
    console.error("[notifyMany] Không tạo được thông báo:", e);
  }
}

// Gộp thông báo like: nếu người này đã có thông báo cùng loại/link CHƯA ĐỌC,
// cộng dồn count + đổi message thay vì tạo dòng mới — tránh spam N thông báo
// riêng lẻ khi 1 bài được nhiều người thích liên tiếp trong thời gian ngắn.
export async function notifyLikeAggregate(
  userId: string,
  data: { type: string; link: string; singularTitle: string; buildMessage: (count: number) => string },
): Promise<void> {
  try {
    const existing = await prisma.notification.findFirst({
      where:   { userId, type: data.type, link: data.link, isRead: false },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const count = existing.count + 1;
      await prisma.notification.update({
        where: { id: existing.id },
        data:  { count, message: data.buildMessage(count), createdAt: new Date() },
      });
    } else {
      await prisma.notification.create({
        data: { userId, type: data.type, title: data.singularTitle, message: data.buildMessage(1), link: data.link },
      });
    }
  } catch (e) {
    console.error("[notifyLikeAggregate] Không tạo được thông báo:", e);
  }
}
