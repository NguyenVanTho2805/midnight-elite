// TUT-002 — Người đang nộp đơn gia sư (role student, có tutorAppliedAt, chưa duyệt,
// chưa bị từ chối) không được TỰ ghi danh vào lớp bằng mã mời như học sinh.
// Hàm thuần: chỉ import `tutorApplicationStatus`, KHÔNG import prisma — để bài
// t-enroll-eligibility-lib.ts chạy không cần DB. Không đọc giờ hệ thống, không ném lỗi.
// BU-00 gộp vào tutorGate sau (src/lib/tutorGate*.ts chưa tồn tại trên nhánh này).
import { tutorApplicationStatus } from "@/lib/tutorProfile";

export const ENROLL_TUTOR_PENDING_MESSAGE =
  "Hồ sơ gia sư của bạn đang chờ duyệt — chưa vào lớp với tư cách học sinh được";
// Giữ đúng chữ cũ ở api/invites/[id]/redeem/route.ts (BE-067).
export const ENROLL_NOT_STUDENT_MESSAGE = "Chỉ học viên mới redeem mã mời";

export type SelfEnrollInput = {
  // User.role: "student" | "admin" — để chuỗi, không ép kiểu, để nhận cả dữ liệu lệch.
  role: string;
  tutorAppliedAt: Date | null;
  tutorVerified: boolean;
  tutorRejectedAt: Date | null;
};

export type SelfEnrollVerdict =
  | { ok: true }
  | { ok: false; reason: "tutor_pending" | "not_student" };

// Thứ tự kiểm: role trước, rồi trạng thái đơn gia sư.
//   - role !== "student"            → not_student (giữ 403 cũ của redeem)
//   - pending                       → tutor_pending (ca TUT-002)
//   - approved nhưng role vẫn student (lệch dữ liệu; reconcileSession sẽ kéo về)
//                                   → not_student — không nói "đang chờ duyệt" sai sự thật
//   - none / rejected               → ok (trở lại là học sinh bình thường)
export function canSelfEnroll(u: SelfEnrollInput): SelfEnrollVerdict {
  if (u.role !== "student") return { ok: false, reason: "not_student" };
  const st = tutorApplicationStatus(u);
  if (st === "pending")  return { ok: false, reason: "tutor_pending" };
  if (st === "approved") return { ok: false, reason: "not_student" };
  return { ok: true };
}
