// TT-201 / TT-199 giai đoạn 1 — ghi nhận "Đã mở Zalo lúc …". KiN chỉ biết gia sư ĐÃ MỞ Zalo với
// tin soạn sẵn, không biết tin có đi thật hay không → tuyệt đối không ghi "đã gửi".
// POST { scheduleId, dateKey, studentId, recipient: "parent"|"student", kind: "h24"|"h1" }
// Chỉ ghi được khi: lớp của chính gia sư, học sinh đang học lớp đó, buổi chưa bắt đầu, tin đã tới
// hạn, học sinh chưa báo nghỉ buổi đó. Ghi lại lần hai thì giữ lần đầu (idempotent).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { dayOfWeekOfKey, dueReminderKinds, isValidDateKey, parseHm } from "@/lib/classSessions";
import { effectiveSlot } from "@/lib/sessionChange";
import { findChange } from "@/lib/sessionChangeServer";

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* 400 bên dưới */ }
  const { scheduleId, dateKey, studentId, recipient, kind } = b;
  if (typeof scheduleId !== "string" || typeof dateKey !== "string" || typeof studentId !== "string"
      || (recipient !== "parent" && recipient !== "student") || (kind !== "h24" && kind !== "h1") || !isValidDateKey(dateKey)) {
    return NextResponse.json({ error: "Thiếu hoặc sai thông tin tin nhắc" }, { status: 400 });
  }

  const sched = await prisma.classSchedule.findUnique({
    where: { id: scheduleId }, select: { courseId: true, dayOfWeek: true, startTime: true, endTime: true, active: true, course: { select: { ownerId: true } } },
  });
  if (!sched || !sched.active || sched.course.ownerId !== auth.userId) return NextResponse.json({ error: "Không tìm thấy buổi học của bạn" }, { status: 404 });
  const startMin = parseHm(sched.startTime);
  if (startMin === null || dayOfWeekOfKey(dateKey) !== sched.dayOfWeek) return NextResponse.json({ error: "Ngày này không có buổi học theo lịch" }, { status: 400 });

  const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: studentId, courseId: sched.courseId } }, select: { status: true } });
  if (!enrolled || enrolled.status !== "active") return NextResponse.json({ error: "Học viên không học lớp này" }, { status: 404 });

  // `dateKey` là ngày GỐC (định danh buổi). Buổi đã huỷ thì không nhắc; buổi đã dời thì nhắc theo giờ MỚI.
  const change = await findChange(prisma, scheduleId, dateKey);
  if (change?.kind === "cancel") return NextResponse.json({ error: "Buổi này đã huỷ, không cần nhắc" }, { status: 409 });
  const startAt = effectiveSlot(sched, dateKey, change)?.startAt;
  if (!startAt) return NextResponse.json({ error: "Giờ học của khung này chưa đặt đúng" }, { status: 400 });
  if (!dueReminderKinds(startAt, new Date()).includes(kind)) return NextResponse.json({ error: "Tin nhắc này chưa tới hạn hoặc buổi học đã bắt đầu" }, { status: 409 });
  const absent = await prisma.classAbsence.findUnique({ where: { scheduleId_dateKey_studentId: { scheduleId, dateKey, studentId } }, select: { id: true } });
  if (absent) return NextResponse.json({ error: "Học viên đã báo nghỉ buổi này, không cần nhắc" }, { status: 409 });

  const key = { scheduleId_dateKey_studentId_recipient_kind: { scheduleId, dateKey, studentId, recipient, kind } };
  const log = await prisma.classReminderLog.upsert({
    where: key,
    create: { courseId: sched.courseId, scheduleId, dateKey, studentId, recipient, kind, tutorId: auth.userId },
    update: {},
  });
  return NextResponse.json({ ok: true, openedAt: log.openedAt.toISOString() });
}
