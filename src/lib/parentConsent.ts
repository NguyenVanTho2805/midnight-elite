// Hằng số dùng chung cho luồng ParentLink/ParentConsent (G1.04, G2.08-G2.11).
// contentVersion để đối chiếu khi có tranh chấp — tăng version này nếu nội
// dung/điều khoản hiển thị cho phụ huynh khi xác nhận thay đổi.
export const PARENT_CONSENT_CONTENT_VERSION = "2026-09-consent-v1";
export const PARENT_CONSENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
