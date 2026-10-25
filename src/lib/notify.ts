import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPushType } from "@/lib/pushRules";

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  link?: string;
};

// ĐX-02: thông báo loại có trong danh sách đẩy (absence_late, bank_tx_pending, invoice_paid, parent_reported, unmarked_daily) còn được ĐẨY ra điện thoại gia sư (src/lib/pushServer.ts).
// Việc đẩy chạy SAU khi phản hồi đã trả (after) nên không làm chậm webhook / API; ngoài phạm vi một yêu cầu (script, test) thì chạy ngay.
// Loại ngoài danh sách thì không tốn thêm gì (không đụng DB, không nạp web-push).
function deferPush(userId: string, type: string, leadMinutes?: number, count?: number): void {
  const run = async () => {
    try {
      const { pushToUser } = await import("@/lib/pushServer");
      await pushToUser(userId, type, { leadMinutes, count });
    } catch (e) {
      console.error("[notify] Không đẩy được thông báo:", e);
    }
  };
  try { after(run); } catch { void run(); }
}

// Tạo thông báo cho 1 user. Cố ý nuốt lỗi — thông báo là tính năng phụ trợ,
// không bao giờ được làm hỏng hành động chính (enroll, reply, like...).
// `leadMinutes`: chỉ cho absence_late — còn bao nhiêu phút tới giờ học (dưới 2 giờ thì được đẩy cả trong giờ yên lặng).
// `count`: chỉ cho unmarked_daily — số buổi chưa điểm danh hôm qua (số nguyên duy nhất được phép lên chữ đẩy).
export async function notify(userId: string, data: NotificationInput, opts: { leadMinutes?: number; count?: number } = {}): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, ...data } });
  } catch (e) {
    console.error("[notify] Không tạo được thông báo:", e);
    return;
  }
  if (isPushType(data.type)) deferPush(userId, data.type, opts.leadMinutes, opts.count);
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
