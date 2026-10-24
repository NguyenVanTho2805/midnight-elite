import { NextRequest, NextResponse } from "next/server";
import { cronSecretMissingIsFatal } from "@/lib/adminOps";
import { recordCronRun } from "@/lib/adminOpsServer";
import { prisma } from "@/lib/prisma";
import { sendClassReminderEmail } from "@/lib/email";
import { notifyMany } from "@/lib/notify";
import { DAY_LABELS_VI, vnDayOfWeek } from "@/lib/types";
import { hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { effectiveSlot } from "@/lib/sessionChange";
import { sendUnmarkedDaily, type UnmarkedDailyResult } from "@/lib/unmarkedDailyServer";

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
  } else if (cronSecretMissingIsFatal()) {
    // QT-03: bản chạy thật thiếu CRON_SECRET thì ĐÓNG (trước đây thiếu khoá là mở công khai); máy thử vẫn chạy được.
    return NextResponse.json({ error: "Chưa cấu hình CRON_SECRET" }, { status: 503 });
  }
  await recordCronRun("remind-class"); // QT-03: dấu "lần gọi gần nhất" cho trang Triển khai và hạn mức

  // NC2-011: tin "Hôm qua có N buổi chưa điểm danh" (gia sư). Chạy SAU phần nhắc học viên để nếu nó chậm / hết giờ thì nhắc lịch học viên ngày mai
  // (việc cũ, quan trọng hơn) đã đi rồi; nhưng phải gọi ở CẢ hai nhánh trả về, vì phần nhắc học viên thoát sớm khi ngày mai không có buổi nào.
  // Lỗi ở đây không được làm hỏng phản hồi của cron.
  const runUnmarked = async (): Promise<UnmarkedDailyResult | { error: true }> => {
    try { return await sendUnmarkedDaily(); } catch (e) { console.error("[cron/remind-class] unmarked_daily:", e); return { error: true }; }
  };

  // Thứ của ngày mai theo giờ VN (UTC+7) — xem vnDayOfWeek trong lib/types.ts
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dow      = vnDayOfWeek(tomorrow);
  const dayLabel = DAY_LABELS_VI[dow];

  // Tìm khung giờ học cố định rơi vào thứ của ngày mai. Gia sư có thể đã HUỶ hoặc DỜI buổi đó, hoặc dời một buổi khác TỚI ngày mai:
  // buổi huỷ / dời đi thì không nhắc; buổi dời tới thì nhắc theo giờ mới. Báo nghỉ khoá theo ngày GỐC (định danh buổi).
  const tomorrowKey = vnDateKeyOf(tomorrow);
  const sel = {
    id: true, dayOfWeek: true, startTime: true, endTime: true, note: true,
    course: { select: { id: true, name: true } },
  } as const;
  const changes = await prisma.classSessionChange.findMany({ where: { OR: [{ dateKey: tomorrowKey }, { newDateKey: tomorrowKey }] } });
  const movedInIds = [...new Set(changes.filter(c => c.kind === "move" && c.newDateKey === tomorrowKey).map(c => c.scheduleId))];
  const rules = await prisma.classSchedule.findMany({ where: { active: true, OR: [{ dayOfWeek: dow }, { id: { in: movedInIds } }] }, select: sel });
  const changeOf = new Map(changes.map(c => [`${c.scheduleId}|${c.dateKey}`, c]));
  const todays: { sched: (typeof rules)[number]; identityKey: string; startTime: string; endTime: string }[] = [];
  const pushIfTomorrow = (sched: (typeof rules)[number], identityKey: string) => {
    const ch = changeOf.get(`${sched.id}|${identityKey}`) ?? null;
    const slot = effectiveSlot(sched, identityKey, ch ? { ...ch, kind: ch.kind === "cancel" ? "cancel" : "move" } : null);
    if (!slot || slot.status === "cancelled" || slot.dateKey !== tomorrowKey) return;
    todays.push({ sched, identityKey, startTime: hmOf(vnMinutesOfDay(slot.startAt)), endTime: hmOf(vnMinutesOfDay(slot.endAt)) });
  };
  for (const sched of rules) {
    if (sched.dayOfWeek === dow) pushIfTomorrow(sched, tomorrowKey);
  }
  for (const c of changes) {
    if (c.kind !== "move" || c.newDateKey !== tomorrowKey || c.dateKey === tomorrowKey) continue; // dời trong ngày đã xử lý ở trên
    const sched = rules.find(r => r.id === c.scheduleId);
    if (sched) pushIfTomorrow(sched, c.dateKey);
  }

  if (todays.length === 0) {
    const unmarked = await runUnmarked();
    return NextResponse.json({ sent: 0, message: `Không có buổi học nào vào ${dayLabel}`, unmarked });
  }

  let totalSent = 0;
  const log: string[] = [];

  for (const { sched, identityKey, startTime, endTime } of todays) {
    // Chỉ em đang học (trước đây lấy cả em đang chờ phụ huynh xác nhận / tạm dừng) và bỏ em đã báo
    // nghỉ buổi này — đặc tả TT-201: "đã báo nghỉ thì không gửi".
    const [enrollments, absent] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: sched.course.id, status: "active" },
        select: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.classAbsence.findMany({
        where: { scheduleId: sched.id, dateKey: identityKey },
        select: { studentId: true },
      }),
    ]);
    const absentIds = new Set(absent.map(a => a.studentId));
    const students = enrollments.map(e => e.user).filter(u => !absentIds.has(u.id));

    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch   = students.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(s =>
          sendClassReminderEmail(s.email, s.name, sched.course.name, dayLabel, startTime, endTime, sched.note, sched.course.id)
        )
      );
      totalSent += results.filter(r => r.status === "fulfilled").length;
      if (i + BATCH_SIZE < students.length) await sleep(BATCH_DELAY);
    }

    await notifyMany(students.map(s => s.id), {
      type:    "class_reminder",
      title:   "Nhắc nhở buổi học",
      message: `Khoá "${sched.course.name}" có buổi học vào ${dayLabel} lúc ${startTime}`,
      link:    `/student/hoc-tap?course=${sched.course.id}`,
    });

    log.push(`${sched.course.name}: ${students.length} học viên`);
  }

  console.log(`[cron/remind-class] ${dayLabel} →`, log.join(" | "), `| Đã gửi: ${totalSent}`);

  const unmarked = await runUnmarked();
  return NextResponse.json({
    day:       dayLabel,
    schedules: log,
    sent:      totalSent,
    unmarked,
  });
}
