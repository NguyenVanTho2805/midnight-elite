// Kiểm quyền cho các route /api/cron/* (Vercel Cron gửi `Authorization: Bearer <CRON_SECRET>`).
//
// Trước 19/10/2026 mỗi route viết `if (secret) { ...kiểm... }` — thiếu biến môi trường thì
// BỎ QUA kiểm tra, ai biết đường dẫn cũng gọi được (gửi email nhắc hàng loạt, hết hạn gói VIP).
// Giờ đóng khi thiếu: không có CRON_SECRET (hoặc quá ngắn) thì không ai gọi được, kể cả Vercel —
// cron hỏng ồn ào (log 503) còn hơn mở cửa im lặng.

import { timingSafeEqual } from "node:crypto";

export const CRON_SECRET_MIN_LENGTH = 16;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

// Thuần (không đọc env, không cần request) để test được.
export function checkCronAuth(secret: string | undefined, authorization: string | null): CronAuthResult {
  if (!secret || secret.length < CRON_SECRET_MIN_LENGTH) {
    return { ok: false, status: 503, error: "Chưa cấu hình CRON_SECRET" };
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Không có quyền truy cập" };
  }
  return { ok: true };
}
