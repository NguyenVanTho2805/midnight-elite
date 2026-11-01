// BU-08 / ADM-002 — báo học sinh khi BÀI HẸN GIỜ đã lên. PHẦN THUẦN (không DB).
// Bài hẹn giờ = `published=true` và `publishedAt` ở tương lai (BU-07 không có cột `scheduledAt`). Trang công khai lọc `publishedAt <= now`
// nên bài HIỆN đúng giờ không cần cron; cron chỉ lo THÔNG BÁO (cùng chữ và loại `article_new` với route lưu bài).
export const SCHEDULE_WINDOW_DAYS = 3;
export const SCHEDULE_BATCH = 20;
const DAY = 86_400_000;

export interface ScheduledCandidate { id: string; slug: string; title: string; published: boolean; publishedAt: Date | null }

export const articleNoticeLink = (slug: string) => `/tin-tuc/${slug}`;
/** Hàng khoá trong SettingKV để hai lần cron chạy chồng nhau không gửi đôi. */
export const articleNotifiedKey = (id: string) => `article.notified.${id}`;
export const articleNoticeText = (title: string) => ({ type: "article_new" as const, title: "Bài viết mới", message: `Bài viết mới: "${title}"` });

/** Cửa sổ ứng viên: đã tới giờ (`publishedAt <= now`) nhưng chưa quá 3 ngày. Cron tắt lâu hơn cửa sổ thì bài lên trong lúc đó mất thông báo (đã biết). */
export function scheduleWindow(now: Date): { gt: Date; lte: Date } {
  return { gt: new Date(now.getTime() - SCHEDULE_WINDOW_DAYS * DAY), lte: now };
}

/**
 * Chọn bài cần báo: đã xuất bản, `publishedAt` trong cửa sổ (không quá 3 ngày, không ở tương lai), CHƯA có thông báo `article_new`
 * trỏ tới bài (bài đăng ngay đã được báo lúc lưu, hoặc đã báo rồi). Cũ nhất trước, tối đa SCHEDULE_BATCH.
 */
export function selectArticlesToNotify(articles: ScheduledCandidate[], alreadyNoticedLinks: ReadonlySet<string>, now: Date): ScheduledCandidate[] {
  const w = scheduleWindow(now);
  return articles
    .filter(a => a.published && a.publishedAt !== null
      && a.publishedAt.getTime() > w.gt.getTime() && a.publishedAt.getTime() <= w.lte.getTime()
      && !alreadyNoticedLinks.has(articleNoticeLink(a.slug)))
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime() || a.id.localeCompare(b.id))
    .slice(0, SCHEDULE_BATCH);
}
