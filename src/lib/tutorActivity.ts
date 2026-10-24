// ĐX-05 (NC1-060..063) — "hoạt động gần đây" của gia sư và thứ tự mặc định của danh sách công khai.
//
// Thọ chốt Q3 (21/10): hồ sơ công khai chỉ hiện BA số tự động — số buổi đã dạy (ĐX-00, "ghi trên KiN"), số lớp / học viên đang dạy,
// và "có dạy trong 30 ngày qua". KHÔNG hiện "điểm danh đúng hạn %" và không còn vế "phụ huynh xác nhận" (cơ chế đó đã gỡ).
//
// "Có dạy trong 30 ngày qua" = có ít nhất MỘT buổi ĐÃ DẠY (định nghĩa của src/lib/taughtSessions.ts: ngày ≤ hôm nay giờ VN và có
// em có mặt/muộn) có ngày từ (hôm nay − 30 ngày) đến hôm nay. Chỉ nói gia sư có ghi sổ gần đây, KHÔNG nói gia sư dạy tốt.
import type { Prisma } from "@/generated/prisma/client";
import { vnDateKeyOf } from "@/lib/classSessions";
import { taughtSessionWhere } from "@/lib/taughtSessions";

export const RECENT_ACTIVE_DAYS = 30;
const DAY = 86_400_000;

/** 00:00 UTC của ngày VN (hôm nay − 30 ngày): mốc dưới của "30 ngày qua" (cùng cách lưu `AttendanceSession.date`). */
export function recentActiveSince(now: Date = new Date()): Date {
  return new Date(`${vnDateKeyOf(new Date(now.getTime() - RECENT_ACTIVE_DAYS * DAY))}T00:00:00Z`);
}

/** Điều kiện Prisma cho `attendanceSession`: buổi đã dạy VÀ nằm trong 30 ngày qua. Trộn lọc lớp bằng spread như `taughtSessionWhere`. */
export function recentTaughtSessionWhere(now: Date = new Date()): Prisma.AttendanceSessionWhereInput {
  const base = taughtSessionWhere(now);
  return { ...base, date: { ...(base.date as Prisma.DateTimeFilter), gte: recentActiveSince(now) } };
}

/** Bản thuần: gia sư có buổi đã dạy mới nhất vào `lastTaughtDate` (00:00 UTC của ngày VN) thì có "hoạt động gần đây" không. */
export function isRecentlyActive(lastTaughtDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastTaughtDate) return false;
  const t = lastTaughtDate.getTime();
  return t >= recentActiveSince(now).getTime() && t <= new Date(`${vnDateKeyOf(now)}T00:00:00Z`).getTime();
}

// ─── Thứ tự danh sách /giang-vien ────────────────────────────────────────────────────────────────────────────
export type TutorSort = "active" | "rating" | "students" | "classes";
export const TUTOR_SORTS: readonly TutorSort[] = ["active", "rating", "students", "classes"];
/** Mặc định: gia sư có dạy gần đây lên trước (Thọ chốt Q3 / kế hoạch ĐX-05). */
export const DEFAULT_TUTOR_SORT: TutorSort = "active";
/** Giá trị lạ hoặc thiếu → mặc định (trước đây giá trị lạ rơi về "rating"). */
export function parseTutorSort(raw: string | null | undefined): TutorSort {
  return (TUTOR_SORTS as readonly string[]).includes(raw ?? "") ? (raw as TutorSort) : DEFAULT_TUTOR_SORT;
}

export interface SortableTutor {
  name: string; classCount: number; studentCount: number; sessionsTaught: number; recentlyActive: boolean;
  rating: { avg: number | null };
}
const byName = (a: SortableTutor, b: SortableTutor) => a.name.localeCompare(b.name, "vi");
const ratingOf = (t: SortableTutor) => t.rating.avg ?? -1;

/**
 * Trả MẢNG MỚI đã sắp, ổn định và xác định (hoà thì theo tên): cùng dữ liệu luôn ra cùng thứ tự.
 * "active": đang hoạt động trước → nhiều buổi đã dạy → đánh giá cao → tên. Gia sư chưa dạy gần đây vẫn hiện, chỉ nằm dưới.
 */
export function sortTutors<T extends SortableTutor>(items: readonly T[], sort: TutorSort): T[] {
  const cmp: Record<TutorSort, (a: T, b: T) => number> = {
    active: (a, b) => Number(b.recentlyActive) - Number(a.recentlyActive) || b.sessionsTaught - a.sessionsTaught || ratingOf(b) - ratingOf(a) || byName(a, b),
    rating: (a, b) => ratingOf(b) - ratingOf(a) || byName(a, b),
    students: (a, b) => b.studentCount - a.studentCount || byName(a, b),
    classes: (a, b) => b.classCount - a.classCount || byName(a, b),
  };
  return [...items].sort(cmp[sort]);
}
