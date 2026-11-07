// "Hàng chờ": đọc dữ liệu thật theo QUYỀN của người đang xem rồi đưa cho src/lib/adminQueue.ts. Chỉ đọc, không ghi.
// BU-08: tải theo quyền từng LOẠI (canSeeKind), đếm CHÍNH XÁC bằng count() (không cắt ở số dòng), phân trang bằng con trỏ (at, id).
// Gia sư (teacher) KHÔNG BAO GIỜ có loại nào (canSeeKind) — họ dùng /lop-cua-toi/kiem-duyet gọi thẳng /api/admin/thread-reports.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { PENDING_TUTOR_WHERE } from "@/lib/tutorApplicationGuard";
import {
  afterCursor, badgeOf, buildAdminQueue, DEFAULT_PAGE_LIMIT, encodeCursor, visibleKinds,
  type GuestRep, type JoinRep, type QueueCursor, type QueueItem, type QueueKind,
} from "@/lib/adminQueue";
import { countGuestQuestions, countJoinCourses, externalSupport, loadGuestQuestions, loadJoinCourses } from "@/lib/adminQueueExternalServer";

export type QueueCounts = Partial<Record<QueueKind, number>>;
export interface QueueLoad { items: QueueItem[]; counts: QueueCounts; badge: number; nextCursor: string | null }

/** Loại người này được xem (đã tính quyền và việc nhánh B có hay chưa). Vai không phải quản lý trung tâm → rỗng. */
export function queueKindsFor(session: SessionPayload): QueueKind[] {
  return session.role === "admin" ? visibleKinds(session.adminRole, externalSupport()) : [];
}

const counters: Record<QueueKind, () => Promise<number | null>> = {
  "gia-su": () => prisma.user.count({ where: PENDING_TUTOR_WHERE }),
  "bai-viet": () => prisma.threadReport.count({ where: { status: "pending" } }),
  "ho-so": () => prisma.tutorProfileReport.count({ where: { status: "open" } }),
  "tra-loi": () => prisma.answerReport.count({ where: { status: "pending" } }),
  "danh-gia": () => prisma.courseReview.count({ where: { status: "pending" } }),
  "nap-coin": () => prisma.coinTopupRequest.count({ where: { status: "pending" } }),
  "khach-hoi": countGuestQuestions,
  "vao-lop": countJoinCourses,
};

/** Đếm chính xác từng loại người xem có quyền. Loại không đủ quyền / chưa hỗ trợ vắng khoá (không phải 0). */
export async function loadQueueCounts(session: SessionPayload): Promise<{ counts: QueueCounts; badge: number }> {
  const kinds = queueKindsFor(session);
  const results = await Promise.all(kinds.map(async k => [k, await counters[k]()] as const));
  const counts: QueueCounts = {};
  for (const [k, n] of results) if (n !== null) counts[k] = n;
  return { counts, badge: badgeOf(counts) };
}

const isStaff = (u: { role: string } | null | undefined) => u?.role === "admin";
const NAME = { select: { name: true, role: true } } as const;

export interface LoadQueueOpts { kind?: QueueKind; limit?: number; cursor?: QueueCursor | null }

export async function loadAdminQueue(session: SessionPayload, opts: LoadQueueOpts = {}, now: Date = new Date()): Promise<QueueLoad> {
  const allowed = queueKindsFor(session);
  const { counts, badge } = await loadQueueCounts(session);
  const want = (k: QueueKind) => allowed.includes(k) && (!opts.kind || opts.kind === k);
  const limit = Math.min(100, Math.max(1, opts.limit ?? DEFAULT_PAGE_LIMIT));
  const take = limit * 2; // chừa chỗ cho các dòng trùng giờ với con trỏ (bị bỏ sau khi gộp)
  const at = opts.cursor ? new Date(opts.cursor.at) : null;
  const since = (field: string) => (at ? { [field]: { gte: at } } : {});

  const [tutors, threads, profiles, answers, reviews, topups, guests, joins] = await Promise.all([
    want("gia-su")
      ? prisma.user.findMany({
          where: { ...PENDING_TUTOR_WHERE, tutorAppliedAt: { not: null, ...(at ? { gte: at } : {}) } }, orderBy: [{ tutorAppliedAt: "asc" }, { id: "asc" }], take,
          select: { id: true, name: true, email: true, phone: true, city: true, emailVerified: true, bio: true, subjects: true, tutorAppliedAt: true },
        })
      : Promise.resolve([]),
    want("bai-viet")
      ? prisma.threadReport.findMany({
          where: { status: "pending", ...since("createdAt") }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
          select: {
            id: true, reason: true, createdAt: true, reporter: NAME,
            thread: { select: { content: true, author: NAME, course: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    want("ho-so")
      ? prisma.tutorProfileReport.findMany({
          where: { status: "open", ...since("createdAt") }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
          select: { id: true, tutorId: true, reason: true, detail: true, channel: true, createdAt: true, tutor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    want("tra-loi")
      ? prisma.answerReport.findMany({
          where: { status: "pending", ...since("createdAt") }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
          select: {
            id: true, reason: true, createdAt: true, reporter: NAME,
            answer: { select: { content: true, rewardPaid: true, author: NAME, question: { select: { title: true } } } },
          },
        })
      : Promise.resolve([]),
    want("danh-gia")
      ? prisma.courseReview.findMany({
          where: { status: "pending", ...since("createdAt") }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
          select: { id: true, rating: true, comment: true, createdAt: true, courseId: true, course: { select: { name: true } }, user: NAME },
        })
      : Promise.resolve([]),
    want("nap-coin")
      ? prisma.coinTopupRequest.findMany({
          where: { status: "pending", ...since("createdAt") }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take,
          select: { id: true, userId: true, amountVnd: true, coinAmount: true, bankRef: true, note: true, createdAt: true, user: NAME },
        })
      : Promise.resolve([]),
    want("khach-hoi") ? loadGuestQuestions(take, at) : Promise.resolve<GuestRep[]>([]),
    want("vao-lop") ? loadJoinCourses() : Promise.resolve<JoinRep[]>([]),
  ]);

  // Số báo cáo đang mở của từng gia sư có mặt trong trang này (một truy vấn gộp, chỉ đếm). Cố ý KHÔNG lọc theo con trỏ trang: N là TỔNG báo cáo đang mở về gia sư đó, gồm cả báo cáo nằm ngoài trang đang xem.
  const openByTutor = new Map<string, number>();
  if (profiles.length > 0) {
    const g = await prisma.tutorProfileReport.groupBy({ by: ["tutorId"], where: { status: "open", tutorId: { in: [...new Set(profiles.map(r => r.tutorId))] } }, _count: { _all: true } });
    for (const x of g) openByTutor.set(x.tutorId, x._count._all);
  }

  const built = buildAdminQueue({
    now, viewerId: session.userId, limit: Number.MAX_SAFE_INTEGER,
    tutors: tutors.filter(t => t.tutorAppliedAt).map(t => ({ id: t.id, name: t.name, email: t.email, phone: t.phone, city: t.city, emailVerified: t.emailVerified, bio: t.bio, subjects: t.subjects, appliedAt: t.tutorAppliedAt! })),
    threads: threads.map(r => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name, reporterStaff: isStaff(r.reporter), author: r.thread.author.name, authorStaff: isStaff(r.thread.author), content: r.thread.content, course: r.thread.course?.name ?? null })),
    profiles: profiles.map(r => ({ id: r.id, tutorId: r.tutorId, tutorName: r.tutor.name, reason: r.reason, detail: r.detail, channel: r.channel, createdAt: r.createdAt, openForTutor: openByTutor.get(r.tutorId) })),
    answers: answers.map(r => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name, reporterStaff: isStaff(r.reporter), author: r.answer.author.name, authorStaff: isStaff(r.answer.author), content: r.answer.content, questionTitle: r.answer.question.title, rewardPaid: r.answer.rewardPaid ?? 0 })),
    reviews: reviews.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, reviewer: r.user.name, reviewerStaff: isStaff(r.user), courseId: r.courseId, courseName: r.course.name })),
    topups: topups.map(r => ({ id: r.id, requesterId: r.userId, requester: r.user.name, requesterStaff: isStaff(r.user), amountVnd: r.amountVnd, coinAmount: r.coinAmount, bankRef: r.bankRef, note: r.note, createdAt: r.createdAt })),
    guests, joins,
  });

  const rest = opts.cursor ? built.items.filter(i => afterCursor(i, opts.cursor!)) : built.items;
  const items = rest.slice(0, limit);
  // Còn trang sau nếu còn dòng đã đọc chưa trả, hoặc có loại đã đầy `take` (có thể còn dòng chưa đọc).
  const full = [tutors, threads, profiles, answers, reviews, topups, guests].some(a => a.length >= take);
  const nextCursor = items.length > 0 && (rest.length > limit || full) ? encodeCursor({ at: items[items.length - 1].at, id: items[items.length - 1].id }) : null;
  return { items, counts, badge, nextCursor };
}
