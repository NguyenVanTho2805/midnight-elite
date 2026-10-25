// Ngày theo giờ Việt Nam (UTC+7) và chuỗi ngày học. Thuần.

export function vnDay(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(day + "T00:00:00Z") + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa `day` (ngày dạng YYYY-MM-DD theo giờ Việt Nam). */
export function weekStart(day: string): string {
  const dow = new Date(day + "T00:00:00Z").getUTCDay(); // 0 = CN
  return addDays(day, -((dow + 6) % 7));
}

/**
 * Chuỗi ngày học: đếm lùi từ hôm nay (hoặc hôm qua nếu hôm nay chưa học).
 * Cho phép bỏ MỘT ngày trong mỗi 7 ngày mà không đứt chuỗi (ngày nghỉ) — bỏ lỡ một ngày không làm hỏng thói quen,
 * bị phạt mới làm hỏng (Lally et al., 2009). Ngày nghỉ không được cộng vào số ngày của chuỗi.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): { days: number; restUsedThisWeek: boolean; activeToday: boolean } {
  const set = new Set(activeDays);
  const activeToday = set.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let days = 0;
  const rests: string[] = [];
  for (let guard = 0; guard < 2000; guard++) {
    if (set.has(cursor)) { days++; cursor = addDays(cursor, -1); continue; }
    // ngày trống: chỉ tha nếu ngày trước đó có học và trong 7 ngày gần nhất của chuỗi chưa dùng ngày nghỉ nào
    const prev = addDays(cursor, -1);
    const recentRest = rests.some(r => Date.parse(r) - Date.parse(cursor) < 7 * 86400_000);
    if (days > 0 && set.has(prev) && !recentRest) { rests.push(cursor); cursor = prev; continue; }
    break;
  }
  const weekAgo = addDays(today, -6);
  return { days, restUsedThisWeek: rests.some(r => r >= weekAgo), activeToday };
}
