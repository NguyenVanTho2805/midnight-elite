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
// Mọi nơi tạo Enrollment (ClassInvite.redeem khi 1.4.6 có; admin/students
// enrollment riêng; hoặc migration seed) PHẢI gọi hàm này thay vì hardcode
// "active" để logic parental consent chốt 1 chỗ, không rải khắp nơi.
//
// Hiện tại — theo D04 chốt 04/10/2026: feature parental consent KHÔNG bật
// trong giai đoạn đầu, mọi Enrollment mới mặc định "active" bất kể tuổi.
// Hàm vẫn tồn tại và nhận userId để khi bật feature chỉ sửa 1 hàm, không
// phải audit lại route nào.
//
// Khi bật (ngưỡng 18 theo D04 tạm chốt), logic sẽ là:
//   1. Lấy user.dateOfBirth
//   2. Nếu tuổi < 18 VÀ chưa có ParentConsent approved → "pending_consent"
//   3. Ngược lại → "active"
// Model `ParentConsent` chưa có trên main — xem BE-047 (chờ nhánh Parent
// merge). Khi có, thêm 2 dòng vào hàm này + đổi return từ Promise về giữ.
export async function deriveStatusForNewEnrollment(userId: string): Promise<EnrollmentStatus> {
  // Placeholder: luôn active cho tới khi parental consent bật (D04). Giữ
  // tham số userId để chữ ký không đổi khi logic bật — callers không phải
  // sửa. Void để ESLint không warn "unused" trước ngày đó.
  void userId;
  return ENROLLMENT_STATUS.ACTIVE;
}
