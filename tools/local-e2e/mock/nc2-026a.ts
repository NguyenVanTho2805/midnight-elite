// NC2-026a — dữ liệu giả cho "Sổ của con": một học sinh MỚI vào lớp của giasu@kin.local, CHƯA có buổi điểm danh nào,
// nhưng phụ huynh đã báo nghỉ một buổi TƯƠNG LAI (ngày mai) → có sẵn bản ghi 'excused' ở ngày mai.
// Trước khi sửa trang này hiện "80% · 1 buổi"; sau khi sửa phải hiện "Chưa có buổi điểm danh". Chạy lặp lại được.
import { mkCourse, mkUser } from "../h";
import { addDaysKey, dayOfWeekOfKey, instantOf, parseHm, vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "../mock-seed";

const COURSE = "Toán 7 — thử báo nghỉ tương lai (dữ liệu giả)";
const STUDENT = "Em Mới Báo Nghỉ (thử)";
const TOKEN = "026a0000026a0000026a0000026a0000"; // 32 ký tự hex hợp lệ

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  let course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: COURSE } });
  if (!course) course = await mkCourse(tutor.id, { name: COURSE });
  const stu = (await prisma.user.findFirst({ where: { name: STUDENT } })) ?? (await mkUser({ name: STUDENT }));
  const parent = (await prisma.user.findFirst({ where: { name: "PH Em Mới (thử)" } })) ?? (await mkUser({ name: "PH Em Mới (thử)" }));
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: stu.id, courseId: course.id } },
    create: { userId: stu.id, courseId: course.id, status: "active" },
    update: { status: "active" },
  });
  await prisma.parentLink.deleteMany({ where: { studentId: stu.id } });
  await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: TOKEN } });

  // Làm sạch để chạy lại: em không có buổi điểm danh nào trước báo nghỉ.
  await prisma.attendanceSession.deleteMany({ where: { courseId: course.id } });
  await prisma.classAbsence.deleteMany({ where: { courseId: course.id } });
  await prisma.classSchedule.deleteMany({ where: { courseId: course.id } });

  const tomorrow = addDaysKey(vnDateKeyOf(new Date()), 1);
  const sched = await prisma.classSchedule.create({ data: { courseId: course.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "19:00", endTime: "20:30" } });
  const startAt = instantOf(tomorrow, parseHm("19:00")!);
  await prisma.classAbsence.create({
    data: {
      courseId: course.id, scheduleId: sched.id, dateKey: tomorrow, startAt, studentId: stu.id, reportedBy: "parent",
      leadMinutes: Math.max(120, Math.round((startAt.getTime() - Date.now()) / 60_000)), reason: "Con đi khám (dữ liệu giả)",
      status: "excused_auto", resolvedAt: new Date(),
    },
  });
  const sess = await prisma.attendanceSession.create({ data: { courseId: course.id, date: new Date(`${tomorrow}T00:00:00Z`), createdBy: tutor.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: sess.id, userId: stu.id, status: "excused", note: "Nghỉ có báo (báo trước giờ học)" } });

  const base = process.env.BASE ?? "http://localhost:3000";
  return [
    `Sổ của con (không cần đăng nhập) — mở ${base}/so-cua-con/${TOKEN} : lớp "${COURSE}" ghi "Chưa có buổi điểm danh" (KHÔNG phải "80% · 1 buổi"); mục "Buổi học sắp tới" vẫn thấy buổi ngày mai ${tomorrow} với trạng thái đã báo nghỉ.`,
    `Báo cáo tháng — đăng nhập giasu@kin.local → báo cáo tháng, chọn "${STUDENT}": môn "${COURSE}" không có chuyên cần (chưa có buổi nào), không tính buổi ngày mai.`,
  ];
}
