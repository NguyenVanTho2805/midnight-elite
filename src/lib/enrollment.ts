// Hằng số & helper cho Enrollment.status — thay chuỗi tự do rải rác trong các
// route. Khi thêm trạng thái mới, khai báo ở đây để không rơi vào tình trạng
// mỗi route hiểu khác nhau. Xem thêm model Enrollment trong prisma/schema.prisma.

export const ENROLLMENT_STATUS = {
  PENDING_CONSENT: "pending_consent",
  ACTIVE:          "active",
  SUSPENDED:       "suspended",
} as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];

// true khi học viên có quyền hoạt động (xem bài, nộp bài, đánh giá) — hiện
// chỉ "active" được, nhưng tách ra 1 chỗ để đổi quy tắc không phải sửa 10 route.
export function isEnrollmentActive(e: { status: string } | null | undefined): boolean {
  return !!e && e.status === ENROLLMENT_STATUS.ACTIVE;
}

// Quyết định status cho Enrollment MỚI TẠO — BE-046.
// Mọi nơi tạo Enrollment (ClassInvite.redeem; admin/enrollments) PHẢI gọi hàm này thay vì hardcode "active"
// để logic đồng ý của phụ huynh chốt 1 chỗ.
//
// 23/10/2026 — chủ dự án quyết "làm đầy đủ, có hộp đồng ý" cho dữ liệu trẻ dưới 16 (CHƯA có ý kiến luật sư).
// CÔNG TẮC `KIN_ENROLL_CONSENT_GATE=1` (mặc định TẮT: không đổi hành vi hiện có của người dùng đang dùng):
// khi bật, học sinh có ngày sinh trong tài khoản cho thấy dưới 16 tuổi, chưa có ParentConsent "approved" nào,
// vào lớp mới sẽ ở "pending_consent" (không có quyền học tới khi phụ huynh duyệt qua /api/parent-consents).
// Học sinh KHÔNG có ngày sinh vẫn "active": tài khoản tự khai, KiN không đoán tuổi. Phần đồng ý của CHÍNH em (từ 7 tuổi) chưa chặn ở đây.
import { CONSENT_ADULT_AGE, ageOnKey } from "@/lib/consentPolicy";
import { vnDateKeyOf } from "@/lib/classSessions";

export function enrollmentStatusFor(o: { gateOn: boolean; birthKey: string | null; now: Date; guardianApproved: boolean }): EnrollmentStatus {
  if (!o.gateOn) return ENROLLMENT_STATUS.ACTIVE;
  const age = ageOnKey(o.birthKey, vnDateKeyOf(o.now));
  if (age === null || age >= CONSENT_ADULT_AGE) return ENROLLMENT_STATUS.ACTIVE;
  return o.guardianApproved ? ENROLLMENT_STATUS.ACTIVE : ENROLLMENT_STATUS.PENDING_CONSENT;
}

export async function deriveStatusForNewEnrollment(userId: string): Promise<EnrollmentStatus> {
  if (process.env.KIN_ENROLL_CONSENT_GATE !== "1") return ENROLLMENT_STATUS.ACTIVE;
  const { prisma } = await import("@/lib/prisma"); // nạp muộn: tệp này cũng được import ở nơi không cần DB
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } });
  const birthKey = u?.dateOfBirth ? new Date(u.dateOfBirth.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : null;
  const approved = await prisma.parentConsent.count({ where: { status: "approved", parentLink: { studentId: userId } } });
  return enrollmentStatusFor({ gateOn: true, birthKey, now: new Date(), guardianApproved: approved > 0 });
}
