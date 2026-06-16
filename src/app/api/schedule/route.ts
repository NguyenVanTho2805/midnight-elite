import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export interface ScheduleEvent {
  id: string;
  type: "exam" | "deadline";
  subject: string;
  topic: string;
  time: string;
  isoDate: string;
  link?: string;
}

function toISO(raw: string): string | null {
  // Handles "YYYY-MM-DD" or "DD/MM/YYYY"
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [d, m, y] = raw.split("/");
  if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().slice(0, 10);

  // 90-day window to avoid loading years of past data
  const ninetyDaysLater = new Date(today);
  ninetyDaysLater.setDate(today.getDate() + 90);
  const maxISO = ninetyDaysLater.toISOString().slice(0, 10);

  const events: ScheduleEvent[] = [];

  // ── Exam events ──────────────────────────────────────────────────────────────
  const exams = await prisma.exam.findMany({
    where: { active: true, status: { not: "completed" } },
    select: { id: true, title: true, category: true, date: true, time: true, azotaUrl: true },
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
    });
  }

  // ── Deadline events (enrolled courses only) ───────────────────────────────
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.userId },
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
      const iso = toISO(lesson.azotaDeadline!);
      if (!iso || iso < todayISO || iso > maxISO) continue;
      events.push({
        id: `deadline-${lesson.id}`,
        type: "deadline",
        subject: lesson.chapter.section.course.name,
        topic: lesson.title,
        time: "23:59",
        isoDate: iso,
        link: lesson.azotaUrl || undefined,
      });
    }
  }

  events.sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.time.localeCompare(b.time));

  return NextResponse.json({ events });
}
