// AS-194 — cron 15 phút/lần quét lịch học sắp tới và gửi notification.
//
// 3 mốc nhắc: 24h, 1h, 30m (giờ yên lặng chỉ 30m vẫn báo — GD-12).
// Dedupe qua ClassReminderLog (unique sessionId+userId+kind) để cron
// trùng khung không gửi 2 lần.
//
// Khác /api/cron/remind-class (nhắc daily tại 0 UTC): cron này granular
// hơn, chạy mỗi 15 phút trên các mốc gần.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ENROLLMENT_STATUS } from "@/lib/enrollment";
import { reminderKindAt, nextSessionDates, shouldSendInQuietHours } from "@/lib/classReminder";

type LogDelegate = {
  create(args: { data: unknown }): Promise<unknown>;
};
const logs = () => (prisma as unknown as { classReminderLog: LogDelegate }).classReminderLog;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
    }
  }

  const now = new Date();
  const sent: Array<{ userId: string; courseId: string; kind: string; sessionAt: string }> = [];
  let skippedQuiet = 0;
  let skippedDup = 0;

  // Lấy mọi ClassSchedule active + course đang mở.
  const schedules = await prisma.classSchedule.findMany({
    where:   { active: true, course: { status: true, classStatus: "open" } },
    include: {
      course: {
        select: {
          id: true, name: true, ownerId: true,
          enrollments: {
            where:  { status: ENROLLMENT_STATUS.ACTIVE },
            select: { userId: true },
          },
        },
      },
    },
  });

  for (const sch of schedules) {
    const sessions = nextSessionDates({
      dayOfWeek: sch.dayOfWeek,
      startTime: sch.startTime,
      nowUTC:    now,
    });

    for (const sessionAt of sessions) {
      const kind = reminderKindAt(sessionAt, now);
      if (!kind) continue;

      // Giờ yên lặng VN — chỉ 30m vẫn báo.
      if (!shouldSendInQuietHours(kind, now)) { skippedQuiet++; continue; }

      // Người cần gửi: tất cả HV active + gia sư sở hữu.
      const recipients = new Set<string>();
      for (const e of sch.course.enrollments) recipients.add(e.userId);
      if (sch.course.ownerId) recipients.add(sch.course.ownerId);

      for (const userId of recipients) {
        try {
          await logs().create({
            data: { userId, courseId: sch.course.id, sessionAt, kind },
          });
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === "P2002") { skippedDup++; continue; }
          console.error("[remind-class-sessions] log fail", e);
          continue;
        }

        try {
          await prisma.notification.create({
            data: {
              userId,
              type:    "class_reminder",
              title:   kindTitle(kind, sch.course.name),
              message: kindMessage(kind, sessionAt, sch.note),
              link:    `/student/hoc-tap?course=${encodeURIComponent(sch.course.id)}`,
            },
          });
          sent.push({ userId, courseId: sch.course.id, kind, sessionAt: sessionAt.toISOString() });
        } catch (e) {
          console.error("[remind-class-sessions] notify fail", e);
        }
      }
    }
  }

  return NextResponse.json({
    now:        now.toISOString(),
    schedules:  schedules.length,
    sent:       sent.length,
    skippedDup,
    skippedQuiet,
  });
}

function kindTitle(kind: string, courseName: string): string {
  if (kind === "24h") return `Mai bạn có lớp "${courseName}"`;
  if (kind === "1h")  return `1 giờ nữa vào lớp "${courseName}"`;
  return `Lớp "${courseName}" sắp bắt đầu`; // 30m
}

function kindMessage(kind: string, sessionAt: Date, note: string | null): string {
  const vnTime = new Date(sessionAt.getTime() + 7 * 60 * 60_000);
  const hhmm = `${String(vnTime.getUTCHours()).padStart(2, "0")}:${String(vnTime.getUTCMinutes()).padStart(2, "0")}`;
  const base = kind === "30m"
    ? `Buổi học bắt đầu lúc ${hhmm} (còn ~30 phút).`
    : kind === "1h"
    ? `Buổi học hôm nay lúc ${hhmm}.`
    : `Lịch mai lúc ${hhmm}.`;
  return note ? `${base} ${note}` : base;
}
