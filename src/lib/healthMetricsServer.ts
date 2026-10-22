// ĐX-04 (NC1-051) — truy vấn cho bảng số đo sức khoẻ sản phẩm. Tính toán nằm ở healthMetrics.ts (thuần, có test).
// Mọi truy vấn chỉ chọn cột cần để đếm: KHÔNG đọc tên học sinh / tên gia sư / nội dung giao dịch / số tiền.
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { taughtSessionWhere } from "@/lib/taughtSessions";
import { PAY_WINDOW_DAYS, activationMetrics, adoptionMetrics, bankMetrics, invoiceMetrics, timelinessMetric } from "@/lib/healthMetrics";

const DAY = 86_400_000;
const dayStart = (t: Date) => new Date(`${vnDateKeyOf(t)}T00:00:00Z`);

export async function loadHealthMetrics(days: number, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  // Chỉ số 3 cần phiếu gửi sớm hơn khoảng đang xem thêm PAY_WINDOW_DAYS ngày.
  const invoiceSince = new Date(since.getTime() - PAY_WINDOW_DAYS * DAY);
  const sinceDate = dayStart(since), todayDate = dayStart(now);

  const [invoices, txs, oldestPending, sessions, tutors, taught] = await Promise.all([
    prisma.tuitionInvoice.findMany({
      where: { sentAt: { gte: invoiceSince, lte: now }, status: { not: "cancelled" } },
      select: { tutorId: true, status: true, sentAt: true, zaloOpenedAt: true, parentViewedAt: true, paidAt: true, viewToken: true },
    }),
    prisma.bankTransaction.findMany({ where: { occurredAt: { gte: since, lte: now } }, select: { provider: true, status: true, occurredAt: true } }),
    prisma.bankTransaction.findFirst({ where: { status: "pending" }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
    prisma.attendanceSession.findMany({
      where: { date: { gte: sinceDate, lte: todayDate } },
      select: { date: true, records: { select: { status: true, createdAt: true } } },
    }),
    // Cùng bộ lọc với danh sách gia sư công khai (api/tutors): đã duyệt, không bị cấm, hồ sơ không bị khoá.
    prisma.user.findMany({ where: { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, profileLockedAt: null }, select: { id: true } }),
    prisma.attendanceSession.findMany({
      where: { ...taughtSessionWhere(now), date: { gte: sinceDate, lte: todayDate } },
      select: { course: { select: { ownerId: true } } },
    }),
  ]);

  // NC2-020 — gia sư mới vào. Tập đo: đăng ký trong khoảng, không bị cấm, hồ sơ không bị khoá; KHÔNG đòi đã duyệt (xem METRIC_DEFS.actClass).
  const signups = await prisma.user.findMany({
    where: { role: "admin", adminRole: "teacher", banned: false, profileLockedAt: null, createdAt: { gte: since, lte: now } },
    select: { id: true, createdAt: true },
  });
  const ownerIds = signups.map(u => u.id);
  const [ownedCourses, firstTaught] = ownerIds.length === 0 ? [[], []] : await Promise.all([
    prisma.course.findMany({ where: { ownerId: { in: ownerIds } }, select: { ownerId: true, createdAt: true } }),
    prisma.attendanceSession.findMany({
      where: { ...taughtSessionWhere(now), course: { ownerId: { in: ownerIds } } },
      select: { date: true, course: { select: { ownerId: true } } },
    }),
  ]);
  const activation = activationMetrics(signups, ownedCourses, firstTaught.map(s => ({ ownerId: s.course.ownerId, date: s.date })), now, days);

  const rows = invoices.map(i => ({
    tutorId: i.tutorId, status: i.status, sentAt: i.sentAt, zaloOpenedAt: i.zaloOpenedAt, parentViewedAt: i.parentViewedAt,
    paidAt: i.paidAt, hasViewLink: i.viewToken !== null,
  }));
  const invoicingIds = rows.filter(r => r.sentAt && r.sentAt.getTime() >= since.getTime()).map(r => r.tutorId);

  return {
    days,
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    invoices: (m => ({ ...m, paidCohort: { from: m.paidCohort.from.toISOString(), to: m.paidCohort.to.toISOString() } }))(invoiceMetrics(rows, now, days)),
    bank: bankMetrics(txs, oldestPending?.occurredAt ?? null, now),
    timeliness: timelinessMetric(sessions),
    activation: (a => ({ ...a, cohort24: { from: a.cohort24.from.toISOString(), to: a.cohort24.to.toISOString() }, cohort7: { from: a.cohort7.from.toISOString(), to: a.cohort7.to.toISOString() } }))(activation),
    tutors: adoptionMetrics(tutors.map(t => t.id), taught.map(s => s.course.ownerId), invoicingIds),
  };
}
export type HealthMetricsPayload = Awaited<ReturnType<typeof loadHealthMetrics>>;
