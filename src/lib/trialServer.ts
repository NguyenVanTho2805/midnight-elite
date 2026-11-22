// SCL đợt 5 — phần MÁY CHỦ của học thử có hạn (luật thuần ở src/lib/trial.ts). Mở đồng hồ (D5), lật hết hạn (D7), xác nhận chính thức / gia hạn (D8, tình huống 12).
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { TRIAL_EXTEND_DAYS, trialEndsAt } from "@/lib/trial";

/** D5 (một hạn chung): em mở lớp / bài lần đầu ⇒ MỌI ghi danh thử còn chưa tính ngày của em bắt đầu từ `now`. Gọi lại không đổi gì. */
export async function startTrialClock(userId: string, now: Date = new Date()): Promise<number> {
  const r = await prisma.enrollment.updateMany({
    where: { userId, trialDays: { not: null }, trialStartedAt: null, status: ENROLLMENT_STATUS.ACTIVE },
    data: { trialStartedAt: now },
  });
  return r.count;
}

/** Mọi đường trả học liệu (lớp, bài, thư viện, video, tệp) gọi hàm này với ghi danh của em: ghi danh thử còn hiệu lực mà chưa tính ngày ⇒ mở đồng hồ (D5).
 *  Một chỗ chung để không đường nào cho xem học liệu mà quên bắt đầu đếm. Lỗi không chặn việc xem. */
export async function openTrialClockFor(userId: string, e: { status: string; trialDays: number | null; trialStartedAt: Date | string | null } | null | undefined): Promise<void> {
  if (e && e.status === ENROLLMENT_STATUS.ACTIVE && e.trialDays !== null && e.trialStartedAt === null) await startTrialClock(userId).catch(() => 0);
}

/** D7: lật active → trial_expired cho ghi danh thử đã quá hạn (trialDays != null ⇒ chưa được xác nhận chính thức). `userId` để lật riêng một em (vỏ học sinh). */
export async function expireTrials(opts: { userId?: string; now?: Date } = {}): Promise<{ id: string; userId: string; courseId: string }[]> {
  const now = opts.now ?? new Date();
  const byUser = opts.userId ? Prisma.sql`AND "userId" = ${opts.userId}` : Prisma.empty;
  return prisma.$queryRaw<{ id: string; userId: string; courseId: string }[]>`
    UPDATE enrollments SET status = ${ENROLLMENT_STATUS.TRIAL_EXPIRED}
    WHERE status = ${ENROLLMENT_STATUS.ACTIVE} AND "trialDays" IS NOT NULL AND "trialStartedAt" IS NOT NULL
      AND "trialStartedAt" + ("trialDays" * interval '1 day') <= ${now}
      ${byUser}
    RETURNING id, "userId", "courseId"`;
}

export type TrialAction = "xac-nhan" | "gia-han";

/** Chủ lớp / quản trị trung tâm xác nhận chính thức (bỏ hạn, giữ điểm/bài) hoặc gia hạn 7 ngày. Chỉ ghi danh THỬ của đúng lớp. false = không có gì để đổi. */
export async function applyTrialAction(courseId: string, enrollmentId: string, action: TrialAction, now: Date = new Date()): Promise<boolean> {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, select: { courseId: true, status: true, trialDays: true, trialStartedAt: true } });
  if (!e || e.courseId !== courseId || e.trialDays === null) return false;
  if (e.status !== ENROLLMENT_STATUS.ACTIVE && e.status !== ENROLLMENT_STATUS.TRIAL_EXPIRED) return false; // đã nghỉ / chờ phụ huynh: không mở lại bằng nút này
  // Gia hạn: còn hạn / chưa bắt đầu ⇒ +7 ngày; đã hết hạn ⇒ thêm 7 ngày TÍNH TỪ HÔM NAY (không thì em hết hạn lâu được "gia hạn" mà vẫn khoá).
  const end = trialEndsAt(e);
  const trialDays = end && end <= now && e.trialStartedAt ? Math.ceil((now.getTime() - e.trialStartedAt.getTime()) / 86_400_000) + TRIAL_EXTEND_DAYS : e.trialDays + TRIAL_EXTEND_DAYS;
  const data = action === "xac-nhan"
    ? { trialDays: null, trialConvertRequestedAt: null, status: ENROLLMENT_STATUS.ACTIVE }
    : { trialDays, status: ENROLLMENT_STATUS.ACTIVE };
  const r = await prisma.enrollment.updateMany({ where: { id: enrollmentId, trialDays: { not: null } }, data });
  return r.count > 0;
}
