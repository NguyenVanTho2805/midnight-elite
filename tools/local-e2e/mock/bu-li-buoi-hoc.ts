// Dữ liệu GIẢ cho BU-01..07, BU-14, LI-02/03/05/06/09/10/11/16/17, DD-03 (trang buổi học + Lịch). Chạy lặp lại được (tìm-trước-tạo-sau).
// Một lớp "Toán 9 thử buổi học" của gia sư chính: khung giờ hằng tuần Offline kèm địa chỉ, màu lớp đã chọn, link chung của lớp; một buổi ĐÃ CHỐT có ghi chép
// 3 phần + nhận xét riêng chia sẻ cho phụ huynh của học sinh chính; một buổi dạy bù sắp tới; một lớp thứ hai CHỒNG GIỜ để thấy cảnh báo xung đột.
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { mkCourse, mkUser } from "../h";
import type { MockCtx } from "../mock-seed";

const TITLE = "Toán 9 thử buổi học";
const TITLE_2 = "Lý 9 thử buổi học (chồng giờ)";
const TOKEN = "b0b0c0ffee00b0b0c0ffee00b0b0c0ff"; // 32 chữ số hex: link Sổ của con cho phụ huynh thử
const day = (k: string) => new Date(`${k}T00:00:00Z`);

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, student } = ctx;
  const today = vnDateKeyOf(new Date());
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: TITLE } });
  if (!c) c = await mkCourse(tutor.id, { name: TITLE });
  await prisma.course.update({ where: { id: c.id }, data: { calendarColor: "lop-09", classJoinUrl: "https://meet.example.com/toan-9-chung" } });
  let c2 = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: TITLE_2 } });
  if (!c2) c2 = await mkCourse(tutor.id, { name: TITLE_2 });

  let other = await prisma.user.findUnique({ where: { email: "hocsinh-buoi-2@kin.local" } });
  if (!other) { const u = await mkUser({ name: "Em Bình (thử buổi học)" }); other = await prisma.user.update({ where: { id: u.id }, data: { email: "hocsinh-buoi-2@kin.local" } }); }
  for (const u of [student, other]) await prisma.enrollment.upsert({ where: { userId_courseId: { userId: u.id, courseId: c.id } }, update: { status: "active" }, create: { userId: u.id, courseId: c.id, status: "active" } });
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c2.id } }, update: { status: "active" }, create: { userId: student.id, courseId: c2.id, status: "active" } });

  // Khung giờ hằng tuần: Toán 9 thứ của hôm nay 19:00–20:30 (Offline, có địa chỉ); Lý 9 cùng thứ 20:00–21:00 (chồng giờ, Online).
  const dow = dayOfWeekOfKey(today);
  if (!(await prisma.classSchedule.findFirst({ where: { courseId: c.id, dayOfWeek: dow, startTime: "19:00" } }))) {
    await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: dow, startTime: "19:00", endTime: "20:30", mode: "offline", location: "Số 5 Ngõ 3, Hà Nội", note: "Mang theo máy tính" } });
  }
  if (!(await prisma.classSchedule.findFirst({ where: { courseId: c2.id, dayOfWeek: dow, startTime: "20:00" } }))) {
    await prisma.classSchedule.create({ data: { courseId: c2.id, dayOfWeek: dow, startTime: "20:00", endTime: "21:00", mode: "online", joinUrl: "https://meet.example.com/ly-9-khung-gio" } });
  }

  // Buổi đã qua (3 ngày trước): ĐÃ CHỐT, ghi chép 3 phần, nhận xét riêng chia sẻ cho phụ huynh của học sinh chính.
  const past = addDaysKey(today, -3);
  let s = await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: c.id, date: day(past) } } });
  if (!s) s = await prisma.attendanceSession.create({ data: { courseId: c.id, date: day(past), createdBy: tutor.id } });
  await prisma.attendanceSession.update({ where: { id: s.id }, data: {
    state: "closed", closedAt: new Date(), closedBy: tutor.id, taught: "Nhận diện phương trình bậc hai; tính Δ và tìm nghiệm.",
    homework: "Bài 1-6 trang 40, nộp trước thứ Sáu.", summary: "Cả lớp theo kịp; cần chú ý dấu của hệ số b.", mode: "online", joinUrl: "https://meet.example.com/toan-9-buoi-rieng",
  } });
  await prisma.attendanceRecord.upsert({ where: { sessionId_userId: { sessionId: s.id, userId: student.id } }, update: { status: "present", note: "Em giải đúng dạng cơ bản, cần thử lại sau phần phân tích nhân tử.", parentVisible: true }, create: { sessionId: s.id, userId: student.id, status: "present", note: "Em giải đúng dạng cơ bản, cần thử lại sau phần phân tích nhân tử.", parentVisible: true } });
  await prisma.attendanceRecord.upsert({ where: { sessionId_userId: { sessionId: s.id, userId: other.id } }, update: { status: "late", note: "Em đến muộn 10 phút (chỉ gia sư xem).", parentVisible: false }, create: { sessionId: s.id, userId: other.id, status: "late", note: "Em đến muộn 10 phút (chỉ gia sư xem).", parentVisible: false } });

  // Buổi dạy bù sắp tới (4 ngày nữa, 09:00–10:30, online).
  const makeup = addDaysKey(today, 4);
  if (!(await prisma.attendanceSession.findUnique({ where: { courseId_date: { courseId: c.id, date: day(makeup) } } }))) {
    await prisma.attendanceSession.create({ data: { courseId: c.id, date: day(makeup), createdBy: tutor.id, kind: "makeup", startTime: "09:00", endTime: "10:30", mode: "online" } });
  }

  // Link Sổ của con cho phụ huynh của học sinh chính (thấy ĐÚNG nhận xét đã chia sẻ).
  let parent = await prisma.user.findUnique({ where: { email: "phuhuynh-buoi@kin.local" } });
  if (!parent) { const u = await mkUser({ name: "Phụ huynh (thử buổi học)" }); parent = await prisma.user.update({ where: { id: u.id }, data: { email: "phuhuynh-buoi@kin.local" } }); }
  const link = await prisma.parentLink.findFirst({ where: { parentId: parent.id, studentId: student.id } });
  if (!link) await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id, status: "verified", verifiedAt: new Date(), portalToken: TOKEN } });
  else if (link.portalToken !== TOKEN) await prisma.parentLink.update({ where: { id: link.id }, data: { status: "verified", portalToken: TOKEN } });

  return [
    `Lịch dạy → /lop-cua-toi/lich (giasu@kin.local): lớp "${TITLE}" màu đã chọn, Offline + địa chỉ, nhãn "Chưa chốt"; bấm buổi → 5 thao tác nhanh, "Điểm danh" mở ngay trên Lịch; "+ Thêm buổi" mở ngăn kéo (thử trùng giờ với lớp Lý 9).`,
    `Trang buổi học → /lop-cua-toi/buoi/${c.id}/${past}: buổi ĐÃ CHỐT, ghi chép 3 phần, nhận xét riêng; thử "Mở lại buổi" và "Chia sẻ báo cáo buổi".`,
    `Trang buổi học hôm nay → /lop-cua-toi/buoi/${c.id}/${today}: chưa có bản ghi, bấm "Đã dạy xong" khi buổi đã tới ngày.`,
    `Buổi dạy bù sắp tới → /lop-cua-toi/buoi/${c.id}/${makeup} (09:00–10:30, Online).`,
    `Màn dời buổi và học bù → /lop-cua-toi/lich rồi mở một buổi chưa bắt đầu → "Dời và học bù".`,
    `Phụ huynh xem nhận xét riêng của đúng em → /so-cua-con/${TOKEN} (mục "Nhận xét của gia sư"; nhận xét của em Bình không hiện).`,
    `Màu lớp và link chung → /admin/khoa-hoc/${c.id}?tab=lich-hoc (bảng 25 màu, link chung, hình thức + địa chỉ khi thêm khung giờ, cảnh báo trùng giờ).`,
  ];
}
