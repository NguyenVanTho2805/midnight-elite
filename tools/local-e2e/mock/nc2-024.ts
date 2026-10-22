// NC2-024 — dữ liệu giả cho "Gửi lịch tuần qua Zalo": một lớp của giasu@kin.local có 3 khung giờ trong tuần HIỆN TẠI
// (một buổi bị huỷ, một buổi bị dời sang thứ Bảy) và link nhóm Zalo thử. Chạy lặp lại được (không nhân đôi).
import { mkCourse } from "../h";
import { addDaysKey, dayOfWeekOfKey, weekRangeOf, vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "../mock-seed";

const NAME = "Văn 8 — thử lịch tuần (dữ liệu giả)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  let course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: NAME } });
  if (!course) course = await mkCourse(tutor.id, { name: NAME });
  await prisma.course.update({ where: { id: course.id }, data: { zaloGroupUrl: "https://zalo.me/g/thu-nghiem" } });

  const from = weekRangeOf(vnDateKeyOf(new Date())).from; // thứ Hai của tuần này
  const mon = from, wed = addDaysKey(from, 2), fri = addDaysKey(from, 4), sat = addDaysKey(from, 5);
  await prisma.classSchedule.deleteMany({ where: { courseId: course.id } });
  const mk = (dateKey: string, startTime: string, endTime: string) =>
    prisma.classSchedule.create({ data: { courseId: course!.id, dayOfWeek: dayOfWeekOfKey(dateKey), startTime, endTime } });
  await mk(mon, "18:00", "19:30");
  const sWed = await mk(wed, "18:00", "19:30");
  const sFri = await mk(fri, "19:00", "20:30");
  await prisma.classSessionChange.deleteMany({ where: { courseId: course.id } });
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: sWed.id, dateKey: wed, kind: "cancel", reason: "Thầy/cô bận", changedBy: tutor.id } });
  await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: sFri.id, dateKey: fri, kind: "move", newDateKey: sat, newStartTime: "16:00", newEndTime: "17:30", reason: "Đổi giờ", changedBy: tutor.id } });

  return [
    `Gửi lịch tuần qua Zalo — đăng nhập giasu@kin.local → Lịch (/lop-cua-toi/lich): thanh "Gửi lịch tuần qua Zalo" phía trên danh sách; chọn lớp "${NAME}" (nếu có nhiều lớp) → bấm nút.`,
    "Trong hộp tin: thứ Hai 18:00–19:30 bình thường, thứ Tư (nghỉ), thứ Sáu dời sang thứ Bảy 16:00–17:30; nút ghi 'Mở nhóm Zalo lớp' vì lớp đã gắn nhóm https://zalo.me/g/thu-nghiem; sau khi mở thấy 'Đã mở Zalo lúc HH:mm'.",
    "Bấm 'Tuần sau →' để thấy tin đổi theo tuần (khung giờ lặp lại hằng tuần, không còn huỷ/dời); lớp không có buổi trong tuần thì nút bị khoá kèm lời giải thích.",
  ];
}
