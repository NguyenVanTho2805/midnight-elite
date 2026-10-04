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
