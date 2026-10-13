// "Chờ kiểm duyệt": đọc dữ liệu thật theo QUYỀN của người đang xem rồi đưa cho src/lib/adminQueue.ts. Chỉ đọc, không ghi.
// Phạm vi giống hệt các trang cũ: quản lý trung tâm (admin_super/admin_content) thấy hồ sơ gia sư + báo cáo bài viết + báo cáo hồ sơ;
// báo cáo câu trả lời cần quyền MANAGE_COMMUNITY; gia sư (teacher) chỉ thấy báo cáo bài viết trong lớp do mình sở hữu.
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";
import { checkPermission, PERMISSIONS } from "@/lib/permissions";
import { PENDING_TUTOR_WHERE } from "@/lib/tutorApplicationGuard";
import { buildAdminQueue, MAX_QUEUE_ITEMS, type QueueItem } from "@/lib/adminQueue";

export async function loadAdminQueue(session: SessionPayload, now: Date = new Date()): Promise<{ items: QueueItem[]; badge: number }> {
  if (session.role !== "admin") return { items: [], badge: 0 };
  const isCenter = session.adminRole === "admin_super" || session.adminRole === "admin_content";
  const isTeacher = session.adminRole === "teacher";
  const canAnswers = checkPermission(session.adminRole, PERMISSIONS.MANAGE_COMMUNITY);
  const take = MAX_QUEUE_ITEMS;

  const [tutors, threads, profiles, answers] = await Promise.all([
    isCenter
      ? prisma.user.findMany({
          where: PENDING_TUTOR_WHERE, orderBy: { tutorAppliedAt: "asc" }, take,
          select: { id: true, name: true, email: true, phone: true, city: true, emailVerified: true, bio: true, subjects: true, tutorAppliedAt: true },
        })
      : Promise.resolve([]),
    isCenter || isTeacher
      ? prisma.threadReport.findMany({
          where: { status: "pending", ...(isTeacher ? { thread: { course: { ownerId: session.userId } } } : {}) },
          orderBy: { createdAt: "asc" }, take,
          select: {
            id: true, reason: true, createdAt: true,
            reporter: { select: { name: true } },
            thread: { select: { content: true, author: { select: { name: true } }, course: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    isCenter
      ? prisma.tutorProfileReport.findMany({
          where: { status: "open" }, orderBy: { createdAt: "asc" }, take,
          select: { id: true, tutorId: true, reason: true, detail: true, channel: true, createdAt: true, tutor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    canAnswers
      ? prisma.answerReport.findMany({
          where: { status: "pending" }, orderBy: { createdAt: "asc" }, take,
          select: {
            id: true, reason: true, createdAt: true,
            reporter: { select: { name: true } },
            answer: { select: { content: true, rewardPaid: true, author: { select: { name: true } }, question: { select: { title: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  return buildAdminQueue({
    now,
    tutors: tutors.filter(t => t.tutorAppliedAt).map(t => ({ id: t.id, name: t.name, email: t.email, phone: t.phone, city: t.city, emailVerified: t.emailVerified, bio: t.bio, subjects: t.subjects, appliedAt: t.tutorAppliedAt! })),
    threads: threads.map(r => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name, author: r.thread.author.name, content: r.thread.content, course: r.thread.course?.name ?? null })),
    profiles: profiles.map(r => ({ id: r.id, tutorId: r.tutorId, tutorName: r.tutor.name, reason: r.reason, detail: r.detail, channel: r.channel, createdAt: r.createdAt })),
    answers: answers.map(r => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, reporter: r.reporter.name, author: r.answer.author.name, content: r.answer.content, questionTitle: r.answer.question.title, rewardPaid: r.answer.rewardPaid ?? 0 })),
  });
}
