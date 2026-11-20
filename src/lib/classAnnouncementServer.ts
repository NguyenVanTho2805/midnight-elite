// TB-LOP (17/11/2026) — phần máy chủ của "Thông báo lớp": đọc danh sách, đăng (kèm thông báo trong ứng dụng cho học sinh active), ghim / bỏ ghim, gỡ.
// Quyền kiểm ở route (src/app/api/courses/[id]/thong-bao*): đăng / ghim / gỡ = CHỈ gia sư chủ lớp; đọc = chủ lớp, quản trị, đồng giảng, học sinh ghi danh active.
// Mọi thao tác trên một tin đều lọc theo { id, courseId } — id tin của lớp khác coi như không có.
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";
import { ANNOUNCE_DAILY_LIMIT, ANNOUNCE_LIST_LIMIT, ANNOUNCE_PIN_MAX, announceNotice, sortAnnouncements, type AnnounceCode } from "@/lib/classAnnouncement";

export interface AnnouncementRow { id: string; body: string; pinned: boolean; createdAt: Date }

/** Tin chưa gỡ của lớp: ghim lên đầu, rồi mới nhất trước, tối đa ANNOUNCE_LIST_LIMIT tin (tin ghim luôn có mặt). Không trả người đăng. */
export async function listAnnouncements(courseId: string): Promise<AnnouncementRow[]> {
  const select = { id: true, body: true, pinned: true, createdAt: true } as const;
  const [pinned, rest] = await Promise.all([
    prisma.classAnnouncement.findMany({ where: { courseId, deletedAt: null, pinned: true }, orderBy: { createdAt: "desc" }, take: ANNOUNCE_PIN_MAX + 5, select }),
    prisma.classAnnouncement.findMany({ where: { courseId, deletedAt: null, pinned: false }, orderBy: { createdAt: "desc" }, take: ANNOUNCE_LIST_LIMIT, select }),
  ]);
  return sortAnnouncements([...pinned, ...rest]).slice(0, Math.max(ANNOUNCE_LIST_LIMIT, pinned.length));
}

/** Số tin lớp đã đăng trong 24 giờ qua (tính cả tin đã gỡ) — cùng cách đếm với giới hạn trong postAnnouncement. */
export async function countRecentAnnouncements(courseId: string, now: Date = new Date()): Promise<number> {
  return prisma.classAnnouncement.count({ where: { courseId, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
}

/**
 * Đăng một tin. Khoá theo lớp (pg_advisory_xact_lock) để hai lần bấm cùng lúc không vượt giới hạn 24 giờ / số tin ghim.
 * Xong thì gửi thông báo trong ứng dụng cho học sinh ghi danh active (ngoài giao dịch; lỗi gửi không làm hỏng việc đăng — notifyMany tự nuốt lỗi).
 */
export async function postAnnouncement(course: { id: string; name: string }, authorId: string, body: string, pinned: boolean, now: Date = new Date()): Promise<AnnounceCode> {
  const code = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"class_announcement:" + course.id}))`;
    const recent = await tx.classAnnouncement.count({ where: { courseId: course.id, createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
    if (recent >= ANNOUNCE_DAILY_LIMIT) return "nhieu" as const;
    if (pinned && (await tx.classAnnouncement.count({ where: { courseId: course.id, deletedAt: null, pinned: true } })) >= ANNOUNCE_PIN_MAX) return "ghim-day" as const;
    await tx.classAnnouncement.create({ data: { courseId: course.id, authorId, body, pinned } });
    return "ok" as const;
  });
  if (code !== "ok") return code;
  const students = await prisma.enrollment.findMany({ where: { courseId: course.id, status: "active" }, select: { userId: true } });
  await notifyMany(students.map(s => s.userId).filter(id => id !== authorId), announceNotice(course.id, course.name));
  return "ok";
}

/** Ghim / bỏ ghim một tin của lớp. Đã đúng trạng thái thì trả luôn mã thành công (bấm hai lần không lỗi). */
export async function setAnnouncementPinned(courseId: string, id: string, pinned: boolean): Promise<AnnounceCode> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"class_announcement:" + courseId}))`;
    const row = await tx.classAnnouncement.findFirst({ where: { id, courseId, deletedAt: null }, select: { pinned: true } });
    if (!row) return "khong-co" as const;
    if (row.pinned === pinned) return pinned ? "ghim" as const : "bo-ghim" as const;
    if (pinned && (await tx.classAnnouncement.count({ where: { courseId, deletedAt: null, pinned: true } })) >= ANNOUNCE_PIN_MAX) return "ghim-day" as const;
    await tx.classAnnouncement.update({ where: { id }, data: { pinned } });
    return pinned ? "ghim" as const : "bo-ghim" as const;
  });
}

/** Gỡ một tin (giữ dòng, đặt deletedAt; bỏ ghim). Tin đã gỡ / của lớp khác → "khong-co". */
export async function removeAnnouncement(courseId: string, id: string): Promise<AnnounceCode> {
  const r = await prisma.classAnnouncement.updateMany({ where: { id, courseId, deletedAt: null }, data: { deletedAt: new Date(), pinned: false } });
  return r.count > 0 ? "xoa" : "khong-co";
}
