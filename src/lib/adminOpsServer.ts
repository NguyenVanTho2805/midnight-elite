// Quản trị: phần có I/O cho QT-02/03/04. Chỉ ĐỌC dữ liệu quản trị (đếm việc chờ, nhật ký, lần gọi tác vụ định kỳ); duy nhất một đường ghi: dấu "lần gọi cron gần nhất" vào SettingKV.
// Không đọc, không trả tên/SĐT/ngày sinh học sinh; không trả `metadata` của nhật ký.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { loadQueueCounts, queueKindsFor } from "@/lib/adminQueueServer";
import type { QueueKind } from "@/lib/adminQueue";
import { countSlowJoinCourses, userNotHiddenWhere } from "@/lib/adminQueueExternalServer";
import { NOT_SYSTEM_ACCOUNT } from "@/lib/adminSystemAccounts";
import { vnDateKeyOf } from "@/lib/classSessions";
import {
  AUDIT_PAGE_SIZE, CRON_JOBS, auditGroupWhere, auditRowView, buildTodayList, cronSettingKey, cronView, groupTodayItems,
  type AuditFilter, type AuditRowView, type CronView, type TodayGroupKey, type TodayItem,
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
    ...(f.nhom ? auditGroupWhere(f.nhom) : {}),
    ...((f.from || f.to) ? { createdAt: { ...(f.from ? { gte: new Date(`${f.from}T00:00:00+07:00`) } : {}), ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00+07:00`).getTime() + 86_400_000) } : {}) } } : {}),
  };
  const rows = await prisma.auditLog.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (f.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE + 1,
    select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, actor: { select: { role: true, adminRole: true, name: true } } },
  });
  return { rows: rows.slice(0, AUDIT_PAGE_SIZE).map(r => auditRowView(r, now)), hasMore: rows.length > AUDIT_PAGE_SIZE, page: f.page };
}

export interface TodayStats { students: number | null; openClasses: number | null; tutors: number | null }
export interface TodayResult {
  items: TodayItem[]; total: number; day: string;
  groups: { key: TodayGroupKey; label: string; items: TodayItem[] }[];
  stats: TodayStats;
}

/**
 * "Hôm nay cần làm gì": đếm việc đang chờ theo QUYỀN của người xem (loại không có quyền thì không đếm, không hiện).
 * Chỉ ĐẾM: không tên người, không số điện thoại, không tổng tiền. Gia sư (teacher) → rỗng (route đã trả 403).
 */
export async function loadTodayList(session: SessionPayload, now: Date = new Date()): Promise<TodayResult> {
  const role = session.adminRole;
  const kinds = new Set(queueKindsFor(session));
  const { counts } = await loadQueueCounts(session);
  const has = (k: QueueKind) => kinds.has(k);
  const centre = session.role === "admin" && (role === "admin_super" || role === "admin_content");
  const can = (p: Parameters<typeof checkPermission>[1]) => centre && checkPermission(role, p);
  const [proOrders, support, scheduled, joinSlow, cronViews, students, openClasses, tutors] = await Promise.all([
    can(PERMISSIONS.MANAGE_REVENUE) ? prisma.proOrder.count({ where: { status: "pending", source: "purchase" } }) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_TUTORS) ? prisma.supportRequest.count({ where: { status: "open" } }) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_NEWS) ? prisma.article.count({ where: { published: true, publishedAt: { gt: now } } }) : Promise.resolve(null),
    has("vao-lop") ? countSlowJoinCourses(now) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_REVENUE) ? loadCronViews(now) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_STUDENTS) ? prisma.user.count({ where: { role: "student", ...NOT_SYSTEM_ACCOUNT, ...userNotHiddenWhere() } }) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_COURSES) ? prisma.course.count({ where: { classStatus: "open" } }) : Promise.resolve(null),
    can(PERMISSIONS.MANAGE_TUTORS) ? prisma.user.count({ where: { role: "admin", adminRole: "teacher", tutorVerified: true } }) : Promise.resolve(null),
  ]);
  const items = buildTodayList({
    tutorsPending: counts["gia-su"] ?? 0, threadReports: counts["bai-viet"] ?? 0, profileReports: counts["ho-so"] ?? 0, answerReports: counts["tra-loi"] ?? 0,
    topupsPending: counts["nap-coin"] ?? null, proOrdersPending: proOrders, supportOpen: support,
    reviewsPending: counts["danh-gia"] ?? null, guestQuestions: counts["khach-hoi"] ?? null,
    joinSlowCourses: joinSlow, scheduledArticles: scheduled,
    cronSlow: cronViews ? cronViews.filter(v => v.tone === "cho").length : null,
  });
  return {
    items, total: items.reduce((s, i) => s + i.count, 0), day: vnDateKeyOf(now),
    groups: groupTodayItems(items), stats: { students, openClasses, tutors },
  };
}
