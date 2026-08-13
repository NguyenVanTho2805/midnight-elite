import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendClassReminderEmail } from "@/lib/email";
import { notifyMany } from "@/lib/notify";
import { DAY_LABELS_VI, vnDayOfWeek } from "@/lib/types";

const BATCH_SIZE  = 20;
const BATCH_DELAY = 1200;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Vercel Cron gọi GET mỗi ngày 0:00 UTC (7:00 SA giờ VN) — cùng lịch với
// remind-exam, xem vercel.json.
// Authorization header: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
    }
  }

  // Thứ của ngày mai theo giờ VN (UTC+7) — xem vnDayOfWeek trong lib/types.ts
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dow      = vnDayOfWeek(tomorrow);
  const dayLabel = DAY_LABELS_VI[dow];

  // Tìm khung giờ học cố định rơi vào thứ của ngày mai
  const schedules = await prisma.classSchedule.findMany({
    where: { active: true, dayOfWeek: dow },
    select: {
      id: true, startTime: true, endTime: true, note: true,
      course: { select: { id: true, name: true } },
    },
  });

  if (schedules.length === 0) {
    return NextResponse.json({ sent: 0, message: `Không có buổi học nào vào ${dayLabel}` });
  }

  let totalSent = 0;
  const log: string[] = [];

  for (const sched of schedules) {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: sched.course.id },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    const students = enrollments.map(e => e.user);

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch   = students.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(s =>
          sendClassReminderEmail(s.email, s.name, sched.course.name, dayLabel, sched.startTime, sched.endTime, sched.note, sched.course.id)
        )
      );
      totalSent += results.filter(r => r.status === "fulfilled").length;
      if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY);
    }

    await notifyMany(students.map(s => s.id), {
      type:    "class_reminder",
      title:   "Nhắc nhở buổi học",
      message: `Khoá "${sched.course.name}" có buổi học vào ${dayLabel} lúc ${sched.startTime}`,
      link:    `/student/hoc-tap?course=${sched.course.id}`,
    });

    log.push(`${sched.course.name}: ${students.length} học viên`);
  }

  console.log(`[cron/remind-class] ${dayLabel} →`, log.join(" | "), `| Đã gửi: ${totalSent}`);

  return NextResponse.json({
    day:       dayLabel,
    schedules: log,
    sent:      totalSent,
  });
}
