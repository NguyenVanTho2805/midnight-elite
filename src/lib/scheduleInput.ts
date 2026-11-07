// TUT-lich-keo-tha — kiểm MỘT khung giờ hằng tuần từ thân yêu cầu (dùng chung: POST /api/courses `schedules[]` và POST class-schedules).
// Thuần (không Prisma). Luật giống hệt POST /api/courses/[id]/class-schedules trước đây, cộng thêm: thứ phải là SỐ NGUYÊN, ghi chú <= 200 ký tự.
import { normalizeHm, normalizeJoinUrl } from "@/lib/classSessions";
import { parseSessionPatch } from "@/lib/sessionBook";

export const SCHEDULE_NOTE_MAX = 200;
export const SCHEDULES_MAX_PER_COURSE = 14;

export interface ScheduleInput {
  dayOfWeek: number; startTime: string; endTime: string;
  note: string | null; joinUrl: string | null; mode: "online" | "offline" | null; location: string | null;
}

/** Lỗi tiếng Việt cho `note` dài quá hạn, hoặc null. */
export function noteError(note: unknown): string | null {
  return typeof note === "string" && note.trim().length > SCHEDULE_NOTE_MAX ? `Ghi chú tối đa ${SCHEDULE_NOTE_MAX} ký tự` : null;
}

export function parseScheduleInput(raw: unknown): { ok: true; value: ScheduleInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Khung giờ không hợp lệ" };
  const b = raw as Record<string, unknown>;
  const { dayOfWeek, startTime, endTime } = b;
  if (typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || typeof startTime !== "string" || typeof endTime !== "string" || !startTime.trim() || !endTime.trim()) {
    return { ok: false, error: "Thiếu thứ trong tuần hoặc giờ bắt đầu/kết thúc" };
  }
  const start = normalizeHm(startTime), end = normalizeHm(endTime);
  if (!start || !end) return { ok: false, error: "Giờ phải có dạng HH:MM, ví dụ 19:00" };
  if (end <= start) return { ok: false, error: "Giờ kết thúc phải sau giờ bắt đầu" };
  if (b.note !== undefined && b.note !== null && typeof b.note !== "string") return { ok: false, error: "Ghi chú phải là chữ" };
  const ne = noteError(b.note);
  if (ne) return { ok: false, error: ne };
  const join = normalizeJoinUrl(b.joinUrl);
  if (!join.ok) return { ok: false, error: "Link vào lớp phải là địa chỉ http(s) hợp lệ" };
  const mp = parseSessionPatch({ mode: b.mode ?? null, location: b.location ?? null });
  if (!mp.ok) return { ok: false, error: mp.error };
  return {
    ok: true,
    value: {
      dayOfWeek, startTime: start, endTime: end,
      note: typeof b.note === "string" ? b.note.trim() || null : null,
      joinUrl: join.value, mode: mp.value.mode ?? null, location: mp.value.location ?? null,
    },
  };
}
