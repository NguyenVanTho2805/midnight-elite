// NC2-011 — tin 07:00 "Hôm qua có N buổi chưa điểm danh": quy tắc THUẦN (không Prisma, không đồng hồ ngầm) để test từng ca biên.
// Phần truy vấn + tạo thông báo ở unmarkedDailyServer.ts; bộ đếm buổi ở unmarkedServer.ts (ĐX-01).
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import type { UnmarkedSession } from "@/lib/unmarkedSessions";

/** "Hôm qua" theo NGÀY VIỆT NAM của `now` (không phải ngày UTC): 00:30 VN = 17:30 UTC hôm trước vẫn lấy ngày VN. */
export const yesterdayKeyVn = (now: Date): string => addDaysKey(vnDateKeyOf(now), -1);

/** Mốc 00:00 ngày VN của `now` (tức 17:00 UTC hôm trước) — buổi gửi đầu tiên của ngày VN đó. Dùng để chống gửi trùng trong ngày. */
export const vnDayStart = (now: Date): Date => new Date(`${vnDateKeyOf(now)}T00:00:00+07:00`);

/** Số buổi chưa điểm danh XẢY RA đúng `dateKey` (buổi dời tính theo ngày hiệu lực; buổi huỷ vốn đã bị loại ở nguồn). Buổi của các ngày cũ hơn KHÔNG tính. */
export function countUnmarkedOn(sessions: readonly Pick<UnmarkedSession, "dateKey">[], dateKey: string): number {
  let n = 0;
  for (const s of sessions) if (s.dateKey === dateKey) n++;
  return n;
}

/** Từ kết quả đếm của từng gia sư → danh sách cần báo: chỉ ai có N ≥ 1; không trùng gia sư; thứ tự theo id để chạy ổn định. */
export function pickTutorsToRemind(counts: readonly (readonly [string, number])[]): { tutorId: string; count: number }[] {
  const out = new Map<string, number>();
  for (const [id, n] of counts) if (Number.isInteger(n) && n >= 1) out.set(id, n);
  return [...out].map(([tutorId, count]) => ({ tutorId, count })).sort((a, b) => a.tutorId.localeCompare(b.tutorId));
}

/** Chữ thông báo trong ứng dụng: dựng từ LOẠI + N; không tên lớp / em. */
export const unmarkedDailyMessage = (count: number): string => `Hôm qua có ${count} buổi chưa điểm danh. Mở Hộp việc để điểm danh bù.`;
