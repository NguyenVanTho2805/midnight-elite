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
