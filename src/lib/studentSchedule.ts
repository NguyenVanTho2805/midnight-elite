// Sự kiện trong lịch của học sinh (buổi thi, hạn nộp, buổi học đã áp dụng huỷ/dời). Tách ra khỏi route /api/schedule để
// "Việc của tôi" dùng chung đúng một nguồn — không có hai cách tính lịch lệch nhau.
import { prisma } from "@/lib/prisma";
import { hmOf, vnMinutesOfDay, vnDateKeyOf, addDaysKey, dayOfWeekOfKey } from "@/lib/classSessions";
import { effectiveSlot } from "@/lib/sessionChange";
import { loadChanges } from "@/lib/sessionChangeServer";
import { parseAzotaDeadline } from "@/lib/azotaDeadline";
import { firstHttpLink } from "@/lib/lessonLinks";

export interface ScheduleEvent {
  id: string;
  type: "exam" | "deadline" | "class";
  subject: string;
  topic: string;
  time: string;
  isoDate: string;
  link?: string;
  /** Giờ kết thúc (chỉ buổi học). */
  endTime?: string;
  /** Mô tả ngắn của đề (chỉ buổi thi), vd "10 câu · 15 phút"; thiếu dữ liệu thì bỏ. */
  meta?: string;
}

function toISO(raw: string): string | null {
  // Handles "YYYY-MM-DD" or "DD/MM/YYYY"
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [d, m, y] = raw.split("/");
  if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return null;
}

export async function loadStudentScheduleEvents(userId: string, now: Date = new Date()): Promise<ScheduleEvent[]> {
  // NC2-035: "hôm nay" và cửa sổ 90 ngày tính theo NGÀY VIỆT NAM bằng khoá ngày (không setHours/toISOString theo múi giờ máy chủ:
  // máy chạy +07 làm khoá ngày lệch 1 ngày so với thứ → buổi huỷ/dời ở lịch học viên rơi sai ngày; máy UTC thì lệch sau 17:00 UTC).
  const todayISO = vnDateKeyOf(now);

  // 90-day window to avoid loading years of past data
  const maxISO = addDaysKey(todayISO, 90);

  const events: ScheduleEvent[] = [];

  // ── Exam events ──────────────────────────────────────────────────────────────
  const exams = await prisma.exam.findMany({
    where: { active: true, status: { not: "completed" } },
    select: { id: true, title: true, category: true, date: true, time: true, azotaUrl: true, duration: true, questions: true },
  });

  for (const exam of exams) {
    const iso = toISO(exam.date);
    if (!iso || iso < todayISO || iso > maxISO) continue;
    events.push({
      id: `exam-${exam.id}`,
      type: "exam",
      subject: exam.category,
      topic: exam.title,
      time: exam.time,
      isoDate: iso,
      link: exam.azotaUrl || undefined,
      meta: [exam.questions > 0 ? `${exam.questions} câu` : "", (/^\d+$/.test(exam.duration?.trim() ?? "") ? `${exam.duration.trim()} phút` : exam.duration?.trim()) || ""].filter(Boolean).join(" · ") || undefined,
    });
  }

  // ── Deadline events (enrolled courses only) ───────────────────────────────
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: "active" },
    select: { courseId: true },
  });

  if (enrollments.length > 0) {
    const courseIds = enrollments.map((e) => e.courseId);

    const lessons = await prisma.lesson.findMany({
      where: {
        azotaDeadline: { not: null },
        chapter: { section: { courseId: { in: courseIds } } },
      },
      select: {
        id: true,
        title: true,
        azotaDeadline: true,
        azotaUrl: true,
        chapter: {
          select: {
            section: {
              select: {
                course: { select: { name: true, category: true } },
              },
            },
          },
        },
      },
    });

    for (const lesson of lessons) {
      // MD-16: hạn Azota là "YYYY-MM-DDTHH:mm" (ô datetime-local, giờ Việt Nam) — đọc bằng parseAzotaDeadline, không phải toISO.
      const dl = parseAzotaDeadline(lesson.azotaDeadline);
      if (!dl || dl.dateKey < todayISO || dl.dateKey > maxISO) continue;
      events.push({
        id: `deadline-${lesson.id}`,
        type: "deadline",
        subject: lesson.chapter.section.course.name,
        topic: lesson.title,
        time: dl.time,
        isoDate: dl.dateKey,
        // Bài có 2 link Azota lưu dạng chuỗi JSON: lấy link http đầu tiên, không đưa chuỗi JSON làm href.
        link: firstHttpLink(lesson.azotaUrl) ?? undefined,
      });
    }

    // ── Class events (khung giờ học cố định hàng tuần — ClassSchedule) ──────
    // Không lưu 1 dòng/buổi trong DB — tự khai triển từ quy luật lặp dayOfWeek
    // ra từng ngày cụ thể trong cửa sổ 90 ngày.
    const classSchedules = await prisma.classSchedule.findMany({
      where: { active: true, courseId: { in: courseIds } },
      select: {
        id: true, dayOfWeek: true, startTime: true, endTime: true, note: true,
        course: { select: { id: true, name: true, category: true } },
      },
    });

    if (classSchedules.length > 0) {
      const windowDates: { iso: string; dow: number }[] = [];
      for (let i = 0; i <= 90; i++) {
        const iso = addDaysKey(todayISO, i);
        windowDates.push({ iso, dow: dayOfWeekOfKey(iso) });
      }

      // Gia sư có thể HUỶ hoặc DỜI một buổi: buổi huỷ vẫn hiện (kèm "ĐÃ HUỶ") để học viên không đi nhầm, buổi dời hiện ở ngày/giờ mới.
      const firstIso = windowDates[0].iso, lastIso = windowDates[windowDates.length - 1].iso;
      const changes = await loadChanges(prisma, classSchedules.map(s => s.id), firstIso, lastIso);
      const changeOf = new Map(changes.map(c => [`${c.scheduleId}|${c.dateKey}`, c]));
      const push = (sched: (typeof classSchedules)[number], originalIso: string) => {
        const slot = effectiveSlot(sched, originalIso, changeOf.get(`${sched.id}|${originalIso}`) ?? null);
        const base = sched.note ? `${sched.course.name} — ${sched.note}` : sched.course.name;
        const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
        const prefix = slot?.status === "cancelled" ? "[ĐÃ HUỶ] " : slot?.status === "moved" ? `[DỜI từ ${dm(originalIso)}] ` : "";
        const isoDate = slot?.dateKey ?? originalIso;
        if (isoDate < firstIso || isoDate > lastIso) return; // dời ra khỏi cửa sổ hiển thị
        events.push({
          id: `class-${sched.id}-${originalIso}`,
          type: "class",
          subject: sched.course.category,
          topic: `${prefix}${base}`,
          time: slot ? hmOf(vnMinutesOfDay(slot.startAt)) : sched.startTime,
          endTime: slot ? hmOf(vnMinutesOfDay(slot.endAt)) : sched.endTime,
          isoDate,
          link: `/student/hoc-tap?course=${sched.course.id}`,
        });
      };

      for (const sched of classSchedules) {
        for (const { iso, dow } of windowDates) {
          if (dow === sched.dayOfWeek) push(sched, iso);
        }
      }
      // Buổi có ngày GỐC đã qua / ngoài cửa sổ nhưng được dời VÀO cửa sổ.
      for (const c of changes) {
        if (c.kind !== "move" || !c.newDateKey || (c.dateKey >= firstIso && c.dateKey <= lastIso)) continue;
        const sched = classSchedules.find(s => s.id === c.scheduleId);
        if (sched) push(sched, c.dateKey);
      }
    }
  }

  events.sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.time.localeCompare(b.time));
  return events;
}
