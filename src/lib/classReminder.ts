// AS-194 (06/10/2026) — tính các mốc nhắc lịch học + dedupe.
//
// 3 kind: "24h" / "1h" / "30m". Cron chạy 15 phút/lần — các mốc rơi
// trong khung ±10 phút quanh mốc thời gian.
//
// Giờ yên lặng (GD-12): 22h-6h GMT+7 → chỉ "30m" vẫn gửi; "24h" và
// "1h" bị chặn (được tính sớm/muộn tránh mốc này).

export type ReminderKind = "24h" | "1h" | "30m";

const MINUTE_MS = 60_000;
const WINDOW_MS = 10 * MINUTE_MS; // ±10 phút

const DELTA_BY_KIND: Record<ReminderKind, number> = {
  "24h": 24 * 60 * MINUTE_MS,
  "1h":  60 * MINUTE_MS,
  "30m": 30 * MINUTE_MS,
};

// Trả về kind nếu `now` đang trong khung nhắc cho `sessionAt`, null nếu
// không phải mốc nào (dùng cho cron bật/tắt gửi).
export function reminderKindAt(sessionAt: Date, now: Date = new Date()): ReminderKind | null {
  const diffToSession = sessionAt.getTime() - now.getTime();
  for (const [kind, delta] of Object.entries(DELTA_BY_KIND) as [ReminderKind, number][]) {
    const d = Math.abs(diffToSession - delta);
    if (d <= WINDOW_MS) return kind;
  }
  return null;
}

// Giờ yên lặng Việt Nam (UTC+7): 22h-6h local = 15-23h UTC.
// Trả true nếu `now` nằm trong khung yên lặng.
export function isQuietHoursVN(now: Date = new Date()): boolean {
  // Chuyển sang GMT+7
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const vnMinutes = (utcMinutes + 7 * 60) % (24 * 60);
  const vnHour = Math.floor(vnMinutes / 60);
  return vnHour >= 22 || vnHour < 6;
}

// Có nên gửi reminder không? GD-12: "30m" vẫn báo trong giờ yên lặng.
export function shouldSendInQuietHours(kind: ReminderKind, now: Date = new Date()): boolean {
  if (!isQuietHoursVN(now)) return true;
  return kind === "30m";
}

// Từ 1 ClassSchedule (dayOfWeek + startTime HH:MM) tính các mốc sessionAt
// trong khoảng [now, now + lookaheadMs]. Giới hạn thực tế: cron chạy
// mỗi 15 phút nên lookahead ~25h để bắt "24h" + chút buffer.
export function nextSessionDates(opts: {
  dayOfWeek: number;      // 0=CN, 1=T2, …, 6=T7 (khớp Date.getDay() giờ VN)
  startTime: string;      // "22:15" theo giờ VN
  nowUTC: Date;
  lookaheadMs?: number;
}): Date[] {
  const look = opts.lookaheadMs ?? 25 * 60 * 60 * 1000;
  const [hh, mm] = opts.startTime.split(":").map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return [];

  const results: Date[] = [];

  // Thuật toán: với mỗi offset ngày VN trong [-1, +8], tạo mốc sessionAt =
  // (ngày VN đó) tại giờ VN startTime, rồi quy đổi UTC. Lọc trong window.
  // 00:00 VN = 17:00 UTC ngày trước. Đơn giản hơn: dùng epoch VN =
  // epochUTC + 7h, rồi dựng Date VN qua UTC constructor.
  const vnOffsetMs = 7 * 60 * 60_000;
  const nowVNms = opts.nowUTC.getTime() + vnOffsetMs;
  const nowVN = new Date(nowVNms); // tất cả getUTC* trên đây = component VN

  for (let dayOffset = -1; dayOffset <= 8; dayOffset++) {
    const vnDay = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate() + dayOffset));
    if (vnDay.getUTCDay() !== opts.dayOfWeek) continue;

    // sessionAt VN = vnDay + hh:mm → UTC = trừ 7h
    const sessionAtUTCms = Date.UTC(
      vnDay.getUTCFullYear(), vnDay.getUTCMonth(), vnDay.getUTCDate(),
      hh, mm, 0, 0,
    ) - vnOffsetMs;

    const diff = sessionAtUTCms - opts.nowUTC.getTime();
    if (diff >= -WINDOW_MS && diff <= look + WINDOW_MS) {
      results.push(new Date(sessionAtUTCms));
    }
  }
  return results;
}
