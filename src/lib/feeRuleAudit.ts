// HOCPHI-THEO-BUOI 3.2 — dựng metadata AuditLog và nội dung thông báo khi QUẢN TRỊ ghi đè đơn giá lớp của gia sư. THUẦN: không Prisma, không node:*.
// Thông báo cố ý KHÔNG có tên lớp, tên em hay số tiền (cũng không có chữ số nào); chỉ có loại + liên kết.

export const FEE_OVERRIDE_TYPE = "course_fee_override";

export type FeeRuleRole = "teacher" | "admin_super" | "admin_content" | "unknown";

/** Vai ghi vào audit; giá trị lạ → "unknown" (không bịa vai). */
export function feeRuleRole(adminRole: unknown): FeeRuleRole {
  return adminRole === "teacher" || adminRole === "admin_super" || adminRole === "admin_content" ? adminRole : "unknown";
}

/** "Ghi đè" = người đặt khác chủ lớp. Lớp không có chủ (lớp trung tâm) thì không có ai để báo → không phải ghi đè. */
export function isFeeOverride(actorId: string, ownerId: string | null | undefined): boolean {
  return !!ownerId && actorId !== ownerId;
}

export interface FeeAuditInput {
  type: "class" | "student";
  actorId: string;
  adminRole: unknown;
  ownerId: string | null;
  effectiveFrom: string;
  rate: number | null;
  sessionMinutes?: number | null;
  studentId?: string;
  /** Đơn giá đang hiệu lực tại ngày hiệu lực MỚI, đọc TRƯỚC khi đổi; null nếu chưa có. */
  previousRate: number | null;
  repriced: number;
  delta: number;
  frozen: number;
}

/** Metadata audit: giữ các khoá cũ (effectiveFrom, rate, studentId|sessionMinutes, repriced, delta, frozen) và thêm byRole, override, ownerId, previousRate, preview. */
export function buildFeeAuditMetadata(i: FeeAuditInput): Record<string, string | number | boolean | null> {
  return {
    effectiveFrom: i.effectiveFrom,
    rate: i.rate,
    ...(i.type === "student" ? { studentId: i.studentId ?? null } : { sessionMinutes: i.sessionMinutes ?? null }),
    repriced: i.repriced,
    delta: i.delta,
    frozen: i.frozen,
    byRole: feeRuleRole(i.adminRole),
    override: isFeeOverride(i.actorId, i.ownerId),
    ownerId: i.ownerId,
    previousRate: i.previousRate,
    preview: false,
  };
}

/** Tên action audit (giữ nguyên tên cũ để bài cũ còn khớp). */
export function feeAuditAction(type: "class" | "student"): "course_fee.set_rate" | "course_fee.set_student_rate" {
  return type === "class" ? "course_fee.set_rate" : "course_fee.set_student_rate";
}

/** Liên kết tới tab Học phí của lớp (đường của gia sư). */
export function feeOverrideLink(courseId: string): string {
  return `/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-phi`;
}

/** Nội dung thông báo cho chủ lớp. Cố định theo loại: không tham số nào ngoài liên kết. */
export function buildFeeOverrideNotification(courseId: string): { type: string; title: string; message: string; link: string } {
  return {
    type: FEE_OVERRIDE_TYPE,
    title: "Quản trị đã đổi đơn giá một lớp của bạn",
    message: "Đơn giá một lớp của bạn vừa được quản trị thay đổi. Mở tab Học phí của lớp để xem lịch sử đơn giá.",
    link: feeOverrideLink(courseId),
  };
}
