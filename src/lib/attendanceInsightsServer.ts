// KiN Pro F4 — nạp dữ liệu cho thống kê chuyên cần nâng cao. Chỉ lớp do ĐÚNG gia sư này làm chủ (Course.ownerId); không nhận id lớp từ ngoài.
// Dùng lại bảng điểm danh có sẵn, không thêm cột. Tên em chỉ xuất hiện trong `streaks`.
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import {
  COMPARE_DAYS, INSIGHT_MIN_SAMPLE, MONTHS_SHOWN, STREAK_MIN, WEEKS_SHOWN, absenceStreaks, compareClasses, lastMonthKeys, lastWeekKeys, trendBy,
  type AbsenceStreak, type ClassCompareRow, type InsRecord, type InsSession, type InsStudent, type TrendPoint,
} from "@/lib/attendanceInsights";

export interface AttendanceInsights {
  asOf: string;
  minSample: number;
  streakMin: number;
  classCount: number;
  weekly: TrendPoint[];
  monthly: TrendPoint[];
  streaks: AbsenceStreak[];
  compare: { fromKey: string; toKey: string; rows: ClassCompareRow[] };
}

export async function loadAttendanceInsights(tutorId: string, now: Date = new Date()): Promise<AttendanceInsights> {
  const todayKey = vnDateKeyOf(now);
  const weekKeys = lastWeekKeys(todayKey, WEEKS_SHOWN), monthKeys = lastMonthKeys(todayKey, MONTHS_SHOWN);
  const fromKey = [weekKeys[0], `${monthKeys[0]}-01`, addDaysKey(todayKey, -(COMPARE_DAYS - 1))].sort()[0];
  const courses = await prisma.course.findMany({ where: { ownerId: tutorId }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  const ids = courses.map(c => c.id);
  const asOf = todayKey;
  if (ids.length === 0) {
    return { asOf, minSample: INSIGHT_MIN_SAMPLE, streakMin: STREAK_MIN, classCount: 0, weekly: trendBy("week", weekKeys, [], []), monthly: trendBy("month", monthKeys, [], []), streaks: [], compare: { fromKey: addDaysKey(todayKey, -(COMPARE_DAYS - 1)), toKey: todayKey, rows: [] } };
  }
  const sessRows = await prisma.attendanceSession.findMany({
    where: { courseId: { in: ids }, date: { gte: new Date(`${fromKey}T00:00:00.000Z`), lte: new Date(`${todayKey}T00:00:00.000Z`) } },
    select: { id: true, courseId: true, date: true },
  });
  const sessions: InsSession[] = sessRows.map(s => ({ id: s.id, courseId: s.courseId, dateKey: s.date.toISOString().slice(0, 10) }));
  const [recRows, enr] = await Promise.all([
    sessions.length === 0 ? Promise.resolve([]) : prisma.attendanceRecord.findMany({ where: { sessionId: { in: sessions.map(s => s.id) } }, select: { sessionId: true, userId: true, status: true } }),
    prisma.enrollment.findMany({ where: { courseId: { in: ids }, status: ENROLLMENT_STATUS.ACTIVE }, select: { userId: true, courseId: true, createdAt: true, user: { select: { name: true } } } }),
  ]);
  const records: InsRecord[] = recRows;
  const students: InsStudent[] = enr.map(e => ({ id: e.userId, name: e.user.name, courseId: e.courseId, enrolledKey: vnDateKeyOf(e.createdAt), active: true }));
  const perCourse = new Map<string, number>();
  for (const s of students) perCourse.set(s.courseId, (perCourse.get(s.courseId) ?? 0) + 1);
  const compareFrom = addDaysKey(todayKey, -(COMPARE_DAYS - 1));
  return {
    asOf, minSample: INSIGHT_MIN_SAMPLE, streakMin: STREAK_MIN, classCount: courses.length,
    weekly: trendBy("week", weekKeys, sessions, records),
    monthly: trendBy("month", monthKeys, sessions, records),
    streaks: absenceStreaks(students, courses, sessions, records, STREAK_MIN),
    compare: { fromKey: compareFrom, toKey: todayKey, rows: compareClasses(courses, perCourse, sessions, records, compareFrom, todayKey) },
  };
}
