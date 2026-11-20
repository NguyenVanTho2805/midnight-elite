// Dữ liệu GIẢ cho DG-HOC-ONLINE (link Meet + email nhắc trước giờ học) và DG-GIAO-LOP (quản trị giao lớp làm chủ lớp).
// Chạy lặp lại được: lớp tìm theo tên + chủ; chỉ tạo khi chưa có. Không có phiếu / khoản phí (không chạm tiền).
import { mkCourse } from "../h";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử Học online)";
const ONLINE = `Toán 8 học Meet ${TAG}`;
const GIAO = `Lớp chờ giao chủ mới ${TAG}`;
const MEET = "https://meet.google.com/kin-thu-mau";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, student, sw } = ctx;
  const tomorrow = addDaysKey(vnDateKeyOf(new Date()), 1);

  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: ONLINE } });
  if (!c) {
    c = await mkCourse(tutor.id, { name: ONLINE });
    await prisma.course.update({ where: { id: c.id }, data: { classJoinUrl: MEET, reminderLeadMinutes: 60 } });
    await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "19:00", endTime: "20:30", mode: "online" } });
  }
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c.id } }, create: { userId: student.id, courseId: c.id, status: "active" }, update: {} });

  // Lớp của gia sư thứ hai (giasu2@kin.local), KHÔNG có phiếu / khoản phí ⇒ quản trị giao được cho giasu@kin.local.
  const other = sw.T;
  let g = await prisma.course.findFirst({ where: { name: GIAO } });
  if (!g) g = await mkCourse(other.id, { name: GIAO });

  return [
    `Học online: giasu@kin.local → /lop-cua-toi/quan-lop/${c.id}?tab=cai-dat&muc=hoc-online · thấy link Meet ${MEET} và "Trước 1 giờ"; hocsinh@kin.local → /student/hoc-tap?course=${c.id} · nút "Mở link học online" (buổi 19:00 ngày mai).`,
    `Email nhắc: gọi GET /api/cron/nhac-buoi-hoc?dryRun=1 với Authorization: Bearer $CRON_SECRET vào khoảng 18:00–18:19 ngày mai ⇒ due 1 (thư thật đi vào thư mục EMAIL_SINK_DIR khi bỏ dryRun).`,
    `Giao lớp: admin@kin.local → /admin/khoa-hoc/${g.id} · tab Cài đặt · khối "Gia sư chủ lớp" (chủ hiện tại: gia sư thứ hai) → chọn gia sư chính → "Giao lớp".`,
  ];
}
