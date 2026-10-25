// Quản trị: phần có I/O cho QT-02/03/04. Chỉ ĐỌC dữ liệu quản trị (đếm việc chờ, nhật ký, lần gọi tác vụ định kỳ); duy nhất một đường ghi: dấu "lần gọi cron gần nhất" vào SettingKV.
// Không đọc, không trả tên/SĐT/ngày sinh học sinh; không trả `metadata` của nhật ký.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { loadAdminQueue } from "@/lib/adminQueueServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import {
  AUDIT_PAGE_SIZE, CRON_JOBS, auditRowView, buildTodayList, cronSettingKey, cronView,
  type AuditFilter, type AuditRowView, type CronView, type TodayItem,
} from "@/lib/adminOps";

/** Ghi dấu "đã gọi" của một tác vụ định kỳ (sau khi qua xác thực). Không bao giờ ném lỗi: việc phụ không được làm hỏng tác vụ chính. */
export async function recordCronRun(job: string, now: Date = new Date()): Promise<void> {
  try {
    const key = cronSettingKey(job);
    await prisma.settingKV.upsert({ where: { key }, create: { key, value: now.toISOString() }, update: { value: now.toISOString() } });
  } catch (e) {
    console.error("[recordCronRun] không ghi được:", e);
  }
}

export async function loadCronViews(now: Date = new Date()): Promise<CronView[]> {
  const rows = await prisma.settingKV.findMany({ where: { key: { in: CRON_JOBS.map(j => cronSettingKey(j.key)) } }, select: { key: true, value: true } });
  const by = new Map(rows.map(r => [r.key, r.value]));
  return CRON_JOBS.map(j => cronView(j, by.get(cronSettingKey(j.key)) ?? null, now));
}

/** Trang nhật ký (mới nhất trước). Chỉ chọn cột an toàn: KHÔNG chọn `metadata`. Tên người thực hiện chỉ lấy ra để auditActor quyết định (nhân sự mới hiện). */
export async function loadAuditPage(f: AuditFilter, now: Date = new Date()): Promise<{ rows: AuditRowView[]; hasMore: boolean; page: number }> {
  const where = {
    ...(f.action ? { action: f.action } : {}),
    ...((f.from || f.to) ? { createdAt: { ...(f.from ? { gte: new Date(`${f.from}T00:00:00+07:00`) } : {}), ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00+07:00`).getTime() + 86_400_000) } : {}) } } : {}),
  };
  const rows = await prisma.auditLog.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (f.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE + 1,
    select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, actor: { select: { role: true, adminRole: true, name: true } } },
  });
  return { rows: rows.slice(0, AUDIT_PAGE_SIZE).map(r => auditRowView(r, now)), hasMore: rows.length > AUDIT_PAGE_SIZE, page: f.page };
}

/** "Hôm nay cần làm gì": đếm việc đang chờ theo QUYỀN của người xem (loại không có quyền thì không đếm, không hiện). */
export async function loadTodayList(session: SessionPayload, now: Date = new Date()): Promise<{ items: TodayItem[]; total: number; day: string }> {
  const role = session.adminRole;
  const queue = await loadAdminQueue(session, now);
  const n = (k: string) => queue.items.filter(i => i.kind === k).length;
  const [topups, proOrders, support] = await Promise.all([
    checkPermission(role, PERMISSIONS.MANAGE_REVENUE) ? prisma.coinTopupRequest.count({ where: { status: "pending" } }) : Promise.resolve(null),
    checkPermission(role, PERMISSIONS.MANAGE_REVENUE) ? prisma.proOrder.count({ where: { status: "pending", source: "purchase" } }) : Promise.resolve(null),
    checkPermission(role, PERMISSIONS.MANAGE_TUTORS) ? prisma.supportRequest.count({ where: { status: "open" } }) : Promise.resolve(null),
  ]);
  const items = buildTodayList({ tutorsPending: n("gia-su"), threadReports: n("bai-viet"), profileReports: n("ho-so"), answerReports: n("tra-loi"), topupsPending: topups, proOrdersPending: proOrders, supportOpen: support });
  return { items, total: items.reduce((s, i) => s + i.count, 0), day: vnDateKeyOf(now) };
}
