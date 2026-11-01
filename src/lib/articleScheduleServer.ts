// BU-08 / ADM-002: gửi thông báo cho bài hẹn giờ đã lên (cron `article-publish`). Phần chọn bài nằm ở articleSchedule.ts (thuần).
// Chống gửi hai lần: (1) bỏ bài đã có Notification `article_new` trỏ tới nó; (2) GIÀNH quyền bằng hàng SettingKV `article.notified.<id>`
// (khoá chính nên hai lần cron chạy chồng nhau chỉ một bên tạo được; bên thua gặp P2002 và bỏ qua).
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { notifyMany } from "@/lib/notify";
import { NOT_SYSTEM_ACCOUNT } from "@/lib/adminSystemAccounts";
import { userNotHiddenWhere } from "@/lib/adminQueueExternalServer";
import { articleNoticeLink, articleNoticeText, articleNotifiedKey, scheduleWindow, selectArticlesToNotify, SCHEDULE_BATCH } from "@/lib/articleSchedule";

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

/** Trả số BÀI đã báo lần này. Không ném lỗi riêng một bài: bài lỗi bỏ qua, các bài khác vẫn chạy. */
export async function runArticlePublishNotices(now: Date = new Date()): Promise<{ notified: number }> {
  const w = scheduleWindow(now);
  const candidates = await prisma.article.findMany({
    where: { published: true, publishedAt: { gt: w.gt, lte: w.lte } },
    orderBy: { publishedAt: "asc" }, take: SCHEDULE_BATCH * 2,
    select: { id: true, slug: true, title: true, published: true, publishedAt: true },
  });
  if (candidates.length === 0) return { notified: 0 };
  const noticed = await prisma.notification.findMany({
    where: { type: "article_new", link: { in: candidates.map(a => articleNoticeLink(a.slug)) } },
    select: { link: true }, distinct: ["link"],
  });
  const todo = selectArticlesToNotify(candidates, new Set(noticed.map(n => n.link).filter((l): l is string => !!l)), now);
  if (todo.length === 0) return { notified: 0 };

  const students = await prisma.user.findMany({
    where: { role: "student", banned: false, ...NOT_SYSTEM_ACCOUNT, ...userNotHiddenWhere() },
    select: { id: true },
  });
  const ids = students.map(s => s.id);

  let notified = 0;
  for (const a of todo) {
    try {
      await prisma.settingKV.create({ data: { key: articleNotifiedKey(a.id), value: now.toISOString() } });
    } catch (e) {
      if (isUniqueViolation(e)) continue; // lần chạy khác đã giành bài này
      console.error("[article-publish] không giành được khoá:", e);
      continue;
    }
    await notifyMany(ids, { ...articleNoticeText(a.title), link: articleNoticeLink(a.slug) });
    await logAction(null, "article.scheduled_notify", "Article", a.id, { recipients: ids.length });
    notified++;
  }
  return { notified };
}
