// ADM-002 — báo "bài mới" cho học sinh NGAY khi quản trị đăng bài (đường API: tạo bài đã đăng / bật đăng). Cùng cơ chế chống gửi đôi với cron `article-publish`
// (articleScheduleServer.ts): GIÀNH quyền bằng hàng SettingKV `article.notified.<id>` (khoá chính, nên hai yêu cầu chồng nhau chỉ một bên tạo được).
// Hệ quả cần có: bật → tắt → bật lại đăng KHÔNG báo lần hai; bài đã báo trước khi có khoá (theo link) cũng không bị báo lại; cron và API không báo đôi nhau.
// Không có nhóm nhận riêng theo tag/lớp: bài viết không có quan hệ tới lớp, nên người nhận vẫn là mọi học sinh đang hoạt động (như cron).
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";
import { NOT_SYSTEM_ACCOUNT } from "@/lib/adminSystemAccounts";
import { userNotHiddenWhere } from "@/lib/adminQueueExternalServer";
import { articleNoticeLink, articleNoticeText, articleNotifiedKey } from "@/lib/articleSchedule";

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

export type ArticleNoticeResult = { sent: boolean; recipients: number; reason?: "da-bao" | "khong-ghi-duoc" };

export async function noticeArticlePublishedNow(a: { id: string; slug: string; title: string }, now: Date = new Date()): Promise<ArticleNoticeResult> {
  const link = articleNoticeLink(a.slug);
  const key = articleNotifiedKey(a.id);
  // Bài đã có thông báo từ trước (khi chưa có khoá, hoặc cron đã báo): ghi khoá rồi thôi, không báo lại.
  const before = await prisma.notification.findFirst({ where: { type: "article_new", link }, select: { id: true } });
  if (before) {
    await prisma.settingKV.createMany({ data: [{ key, value: now.toISOString() }], skipDuplicates: true }).catch(() => {});
    return { sent: false, recipients: 0, reason: "da-bao" };
  }
  try {
    await prisma.settingKV.create({ data: { key, value: now.toISOString() } });
  } catch (e) {
    if (isUniqueViolation(e)) return { sent: false, recipients: 0, reason: "da-bao" };
    throw e;
  }
  const students = await prisma.user.findMany({ where: { role: "student", banned: false, ...NOT_SYSTEM_ACCOUNT, ...userNotHiddenWhere() }, select: { id: true } });
  const ids = students.map(s => s.id);
  await notifyMany(ids, { ...articleNoticeText(a.title), link });
  // notifyMany NUỐT lỗi (notify.ts, tệp chung): không có thông báo nào ghi được thì nhả khoá để lần đăng/cron sau thử lại, không báo "đã gửi".
  if (ids.length > 0 && (await prisma.notification.count({ where: { type: "article_new", link } })) === 0) {
    await prisma.settingKV.delete({ where: { key } }).catch(() => {});
    console.error("[articles] không ghi được thông báo cho bài", a.id, "— sẽ thử lại ở lần đăng/cron sau");
    return { sent: false, recipients: 0, reason: "khong-ghi-duoc" };
  }
  return { sent: true, recipients: ids.length };
}
