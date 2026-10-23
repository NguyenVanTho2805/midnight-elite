// KH-04 / PH-07 phía máy chủ: sinh mã theo dõi, băm số điện thoại để chống spam (một chiều, không dùng để hiện), tự đóng yêu cầu quá hạn và xoá số liên hệ.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requestExpireCutoff } from "@/lib/tutorRequest";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";

export const newTrackToken = (): string => randomBytes(16).toString("hex");

/** Băm một chiều số điện thoại + khoá bí mật của máy chủ: chỉ để đếm "một số gửi mấy lần", không đảo ngược được. */
export function phoneKeyOf(phone: string): string {
  return createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}|req|${phone}`).digest("hex").slice(0, 32);
}

/** Xoá dữ liệu liên hệ khỏi yêu cầu (đóng / từ chối / nhận xong). Giữ cấp học, môn, khung giờ, trạng thái để phụ huynh còn theo dõi được. */
export const SCRUB = { contactPhone: "", contactName: null, note: null } as const;

/** Yêu cầu chưa ai phản hồi quá hạn → đóng + xoá liên hệ + thu hồi dòng đồng ý. Gọi lười ở mọi nơi đọc (không cần cron). */
export async function expireOldRequests(now = new Date()): Promise<number> {
  const old = await prisma.tutorRequest.findMany({ where: { status: "new", createdAt: { lt: requestExpireCutoff(now) } }, select: { id: true }, take: 200 });
  if (!old.length) return 0;
  const ids = old.map(o => o.id);
  await prisma.$transaction([
    prisma.tutorRequest.updateMany({ where: { id: { in: ids }, status: "new" }, data: { status: "closed", decidedAt: now, ...SCRUB } }),
    prisma.consentRecord.updateMany({ where: { subjectType: "tutor_request", subjectId: { in: ids }, revokedAt: null }, data: { revokedAt: now, revokeCause: "request_expired" } }),
  ]);
  return ids.length;
}

/** Gia sư đang CÔNG KHAI (đã duyệt, chưa khoá, chưa ẩn, không bị cấm) — cùng điều kiện với /api/tutors/[id]. */
export async function publicTutor(id: string): Promise<{ id: string; name: string } | null> {
  const t = await prisma.user.findFirst({
    where: { id, role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, profileLockedAt: null },
    select: { id: true, name: true, preferences: true },
  });
  if (!t || isProfileHidden(readPreferences(t.preferences))) return null;
  return { id: t.id, name: t.name };
}

/** Tiếp nhận yêu cầu không dùng trường tuỳ chỉnh: bộ id rỗng (id lạ trong customData bị từ chối). */
export const tutorCustomIdsNone: ReadonlySet<string> = new Set<string>();
