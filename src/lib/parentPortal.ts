// TK-178 (09/10/2026) — token "Sổ của con" công khai cho phụ huynh.
//
// Phụ huynh chưa đăng ký tài khoản mở link gia sư gửi là xem được báo cáo
// của con. Token:
//  - 32 ký tự hex (16 bytes = 128 bit entropy) — brute-force không ăn.
//  - Lưu nguyên trong ParentLink.portalToken (link cấp lv 1, không có
//    quyền ghi — nếu bị lộ chỉ xem được).
//  - Revoke = set NULL. Mỗi lần gia sư rotate thì sinh token mới, link cũ
//    chết ngay.

import { randomBytes } from "node:crypto";

export function generatePortalToken(): string {
  // 16 bytes = 32 ký tự hex. Entropy đủ, URL ngắn (/so-cua-con/abc…).
  return randomBytes(16).toString("hex");
}

// Validate shape — tránh query DB với rác người dùng gõ.
export function isValidPortalToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{32}$/.test(s);
}
