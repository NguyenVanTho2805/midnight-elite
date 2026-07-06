import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExamReminderEmail } from "@/lib/email";
import { notifyMany } from "@/lib/notify";

const BATCH_SIZE  = 20;
const BATCH_DELAY = 1200;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Vercel Cron gọi GET mỗi ngày 0:00 UTC (7:00 SA giờ VN)
// Authorization header: Bearer CRON_SECRET
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
    }
  }

  // Ngày mai theo UTC+7 (Vietnam Standard Time)
  const now      = new Date();
  const vn       = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const tomorrow = new Date(vn.getTime() + 24 * 60 * 60 * 1000);
  const dateStr  = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Tìm kỳ thi diễn ra vào ngày mai
  const exams = await prisma.exam.findMany({
    where: { date: dateStr, active: true },
    select: { id: true, title: true, category: true, date: true, time: true, azotaUrl: true },
  });

  if (exams.length === 0) {
    return NextResponse.json({ sent: 0, message: `Không có kỳ thi ngày ${dateStr}` });
  }

  let totalSent = 0;
  const log: string[] = [];

  for (const exam of exams) {
    // Tìm học viên đăng ký khoá học có cùng category với kỳ thi
    const enrollments = await prisma.enrollment.findMany({
      where: {
        course: { category: { contains: exam.category.split(" ")[0] } },
      },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Loại trùng (1 học viên có thể enroll nhiều khoá cùng category)
    const seen = new Set<string>();
    const students = enrollments
      .map(e => e.user)
      .filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });

    // Gửi email theo batch
    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch   = students.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(s =>
          sendExamReminderEmail(s.email, s.name, exam.title, exam.date, exam.time, exam.azotaUrl ?? null)
        )
      );
      totalSent += results.filter(r => r.status === "fulfilled").length;
      if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY);
    }

    await notifyMany(students.map(s => s.id), {
      type:    "exam_reminder",
      title:   "Nhắc nhở thi thử",
      message: `Đề thi "${exam.title}" sẽ diễn ra vào ${exam.date} lúc ${exam.time}`,
      link:    `/thi-thu`,
    });

    log.push(`${exam.title}: ${students.length} học viên`);
  }

  console.log(`[cron/remind-exam] ${dateStr} →`, log.join(" | "), `| Đã gửi: ${totalSent}`);

  return NextResponse.json({
    date:  dateStr,
    exams: log,
    sent:  totalSent,
  });
}
