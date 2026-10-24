// HV-04 — dữ liệu GIẢ cho 3 thẻ số buổi trong tháng ở Hộp việc (/lop-cua-toi): Đã lên lịch / Hoàn thành / Đã nghỉ.
// Tạo một lớp thử của giasu@kin.local học T2-T4-T6, rồi trong THÁNG HIỆN TẠI (giờ VN): các buổi đã qua → chốt "Đã dạy xong"
// (trừ một buổi bị huỷ), các buổi chưa tới → còn "Đã lên lịch". Luôn có ít nhất một buổi huỷ để thẻ "Đã nghỉ" khác 0.
// Chạy lặp lại được: xoá phần của chính lớp thử này rồi dựng lại, không động tới lớp khác.
import { mkCourse, mkUser } from "../h";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import type { MockFn } from "../mock-seed";

const COURSE = "Toán 8 — thử số buổi trong tháng (dữ liệu giả)";
const STUDENT = "Em Số Buổi (thử)";
const DAYS = [1, 3, 5];

const mock: MockFn = async ({ prisma, tutor }) => {
  let course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: COURSE } });
  if (!course) course = await mkCourse(tutor.id, { name: COURSE });
  const stu = (await prisma.user.findFirst({ where: { name: STUDENT } })) ?? (await mkUser({ name: STUDENT }));
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: stu.id, courseId: course.id } },
    create: { userId: stu.id, courseId: course.id, status: "active" }, update: { status: "active" },
  });
  await prisma.attendanceSession.deleteMany({ where: { courseId: course.id } }); // cascade xoá cả bản ghi điểm danh
  await prisma.classSessionChange.deleteMany({ where: { courseId: course.id } });
  await prisma.classSchedule.deleteMany({ where: { courseId: course.id } });
  const scheds = new Map<number, string>();
  for (const dow of DAYS) {
    const s = await prisma.classSchedule.create({ data: { courseId: course.id, dayOfWeek: dow, startTime: "18:00", endTime: "19:30", active: true } });
    scheds.set(dow, s.id);
  }

  const todayKey = vnDateKeyOf(new Date());
  const monthPrefix = todayKey.slice(0, 7);
  const days: string[] = [];
  for (let k = `${monthPrefix}-01`; k.startsWith(monthPrefix); k = addDaysKey(k, 1)) if (DAYS.includes(dayOfWeekOfKey(k))) days.push(k);
  const past = days.filter(k => k < todayKey), future = days.filter(k => k >= todayKey);
  // Một buổi huỷ: buổi đã qua đầu tiên nếu có, không thì buổi sắp tới đầu tiên → luôn có đủ ba loại khi tháng đủ buổi.
  const cancelKey = past[0] ?? future[0];
  let closed = 0, open = 0, cancelled = 0;
  for (const k of days) {
    if (k === cancelKey) {
      await prisma.classSessionChange.create({ data: { courseId: course.id, scheduleId: scheds.get(dayOfWeekOfKey(k))!, dateKey: k, kind: "cancel", reason: "Thầy/cô bận (dữ liệu giả)", changedBy: tutor.id } });
      cancelled++;
    } else if (k < todayKey) {
      const s = await prisma.attendanceSession.create({ data: { courseId: course.id, date: new Date(`${k}T00:00:00Z`), createdBy: tutor.id, state: "closed", closedAt: new Date(`${k}T13:00:00Z`), closedBy: tutor.id } });
      await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: stu.id, status: "present", updatedBy: tutor.id } });
      closed++;
    } else open++;
  }
  return [`HV-04 · giasu@kin.local → /lop-cua-toi (Hộp việc), khối "Buổi học trong tháng": lớp "${COURSE}" đóng góp ${open} đã lên lịch · ${closed} hoàn thành · ${cancelled} đã nghỉ (cộng với các lớp thử khác của gia sư).`];
};
export default mock;
