// HP-28 — gợi ý "phí trễ hạn" trên phiếu QUÁ HẠN của gia sư (phần THUẦN). Chủ chốt 24/10/2026: CHỈ là dòng chữ gợi ý hiển thị.
//   • KHÔNG tự cộng tiền, KHÔNG sinh dòng phí, KHÔNG đổi phiếu / số còn lại / hạn đóng. Không có số tiền nào ở đây.
//   • Bật/tắt theo từng gia sư, lưu ở setting_kv (khoá `invoice.lateFeeHint.<tutorId>`; "0" = tắt, thiếu hoặc giá trị khác = bật).
//   • Chỉ phiếu CÒN NỢ và đã QUÁ HẠN (có hạn đóng và hạn đã qua); phiếu đã thu đủ / đã huỷ / chưa tới hạn thì không hiện.
export const LATE_FEE_HINT_KEY_PREFIX = "invoice.lateFeeHint.";
export const lateFeeHintKey = (tutorId: string) => `${LATE_FEE_HINT_KEY_PREFIX}${tutorId}`;
export const LATE_FEE_HINT_TEXT = "Gợi ý: có thể thu thêm phí trễ hạn — KiN không tự cộng tiền.";

/** Giá trị cấu hình → bật/tắt. Chưa cấu hình (null/undefined) = bật; chỉ đúng chuỗi "0" mới tắt. */
export function parseLateFeeHintSetting(value: string | null | undefined): boolean {
  return value !== "0";
}

export function showLateFeeHint(i: { enabled: boolean; status: string; remaining: number; overdueDays: number }): boolean {
  if (!i.enabled) return false;
  if (i.status === "cancelled" || i.status === "paid") return false;
  return i.remaining > 0 && i.overdueDays > 0;
}
