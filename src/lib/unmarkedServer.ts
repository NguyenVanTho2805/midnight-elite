// ĐX-01 — truy vấn cho "Buổi đã qua giờ, chưa điểm danh xong". Quy tắc thuần ở unmarkedSessions.ts.
//
// Cố ý KHÔNG gọi loadTutorSchedule (reminderServer.ts): hàm đó dựng tin nhắc cho từng em × từng buổi, thừa cho cửa sổ quá khứ.
// Ở đây chỉ cần: các buổi hiệu lực (đã áp dụng dời/huỷ), em đang học, bản ghi điểm danh, báo nghỉ.
//
// Bộ đếm này chạy mỗi lần tải số đỏ trên thanh module (loadTutorTodoCounts) nên: thoát sớm khi chưa có buổi nào tới hạn,
// và mọi truy vấn khoá theo gia sư + chỉ các lớp/ngày có buổi tới hạn.
import { prisma } from "@/lib/prisma";
import { addDaysKey, UNMARKED_GRACE_MIN, UNMARKED_WINDOW_DAYS, vnDateKeyOf } from "@/lib/classSessions";
import { applyChanges } from "@/lib/sessionChange";
import { loadChanges } from "@/lib/sessionChangeServer";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import {
  absenceKey, findUnmarkedSessions, recordKey,
  type UnmarkedOccurrence, type UnmarkedSession, type UnmarkedStudent,
} from "@/lib/unmarkedSessions";

/** `AttendanceSession.date` lưu 00:00 UTC của ngày VN (xem normalizeAttendanceDate). */
const sessionDate = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

export async function loadUnmarkedSessions(tutorId: string, now: Date = new Date()): Promise<UnmarkedSession[]> {
  const today = vnDateKeyOf(now);
  const from = addDaysKey(today, -UNMARKED_WINDOW_DAYS);

  const courses = await prisma.course.findMany({
    where: { ownerId: tutorId },
    select: {
      id: true, name: true, classStatus: true,
      classSchedules: { where: { active: true }, select: { id: true, courseId: true, dayOfWeek: true, startTime: true, endTime: true, createdAt: true } },
    },
  });
  const rules = courses.flatMap(c => c.classSchedules);
  if (rules.length === 0) return [];
  const courseOf = new Map(courses.map(c => [c.id, c]));
  const createdAtOf = new Map(rules.map(r => [r.id, r.createdAt]));

  const changes = await loadChanges(prisma, rules.map(r => r.id), from, today);
  const dueBefore = now.getTime() - UNMARKED_GRACE_MIN * 60_000;
  const due = applyChanges(rules, changes, from, today).filter(o => o.status !== "cancelled" && o.endAt.getTime() <= dueBefore);
  if (due.length === 0) return [];

  const occurrences: UnmarkedOccurrence[] = due.map(o => ({
    scheduleId: o.scheduleId, courseId: o.courseId, courseName: courseOf.get(o.courseId)?.name ?? "",
    courseOpen: courseOf.get(o.courseId)?.classStatus === "open",
    dateKey: o.dateKey, originalDateKey: o.originalDateKey, startAt: o.startAt, endAt: o.endAt, status: o.status,
    ruleCreatedAt: createdAtOf.get(o.scheduleId) ?? new Date(0),
  }));

  const courseIds = [...new Set(occurrences.filter(o => o.courseOpen).map(o => o.courseId))];
  if (courseIds.length === 0) return [];
  const scheduleIds = [...new Set(occurrences.map(o => o.scheduleId))];
  const dateKeys = [...new Set(occurrences.map(o => o.dateKey))];
  const originalKeys = [...new Set(occurrences.map(o => o.originalDateKey))];

  const [enrollments, records, absences] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: ENROLLMENT_STATUS.ACTIVE },
      select: { courseId: true, createdAt: true, user: { select: { id: true, name: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { session: { courseId: { in: courseIds }, date: { in: dateKeys.map(sessionDate) } } },
      select: { userId: true, session: { select: { courseId: true, date: true } } },
    }),
    prisma.classAbsence.findMany({
      where: { scheduleId: { in: scheduleIds }, dateKey: { in: originalKeys } },
      select: { scheduleId: true, dateKey: true, studentId: true },
    }),
  ]);

  const studentsByCourse = new Map<string, UnmarkedStudent[]>();
  for (const e of enrollments) {
    const list = studentsByCourse.get(e.courseId) ?? [];
    list.push({ id: e.user.id, name: e.user.name, enrolledAt: e.createdAt });
    studentsByCourse.set(e.courseId, list);
  }
  const recorded = new Set(records.map(r => recordKey(r.session.courseId, r.session.date.toISOString().slice(0, 10), r.userId)));
  const handled = new Set(absences.map(a => absenceKey(a.scheduleId, a.dateKey, a.studentId)));

  return findUnmarkedSessions({ now, occurrences, studentsByCourse, recorded, handled });
}
