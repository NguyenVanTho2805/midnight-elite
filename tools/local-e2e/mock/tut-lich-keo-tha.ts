// TUT-lich-keo-tha — dữ liệu giả cho lưới khung giờ KÉO-THẢ. Của giasu@kin.local (thêm 3 lớp, chạy lặp lại không nhân đôi):
//  • "Toán 9 — lịch kéo-thả (thử)": 2 khung (Thứ Ba 19:00–20:30, Thứ Năm 19:00–20:30) → sửa thử bằng chuột / bàn phím / chạm.
//  • "Lý 8 — lịch kéo-thả (thử)": khung Thứ Tư 18:30–20:00 và Thứ Sáu 20:00–21:00 + 1 em học cả hai lớp → kéo khối Toán 9 vào Thứ Tư 19:00 để thấy "Trùng giờ"
//    (kéo vào Thứ Sáu 19:00–20:00 chạm đầu thì KHÔNG trùng).
//  • "Văn 7 — chưa có lịch (thử)": lớp KHÔNG có khung → callout "Lớp chưa có lịch học" ở trang lớp, "Đặt lịch" ở danh sách lớp, hàng "chưa có lịch" ở Hộp việc.
import { mkCourse, mkUser } from "../h";
import type { MockCtx } from "../mock-seed";

const N_TOAN = "Toán 9 — lịch kéo-thả (thử)", N_LY = "Lý 8 — lịch kéo-thả (thử)", N_VAN = "Văn 7 — chưa có lịch (thử)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  const get = async (name: string) => (await prisma.course.findFirst({ where: { ownerId: tutor.id, name } })) ?? mkCourse(tutor.id, { name });
  const toan = await get(N_TOAN), ly = await get(N_LY), van = await get(N_VAN);
  await prisma.classSchedule.deleteMany({ where: { courseId: { in: [toan.id, ly.id, van.id] } } });
  const mk = (courseId: string, dayOfWeek: number, startTime: string, endTime: string) => prisma.classSchedule.create({ data: { courseId, dayOfWeek, startTime, endTime } });
  await mk(toan.id, 2, "19:00", "20:30"); await mk(toan.id, 4, "19:00", "20:30");
  await mk(ly.id, 3, "18:30", "20:00"); await mk(ly.id, 5, "20:00", "21:00");
  const em = (await prisma.user.findFirst({ where: { name: "Em Thử Hai Lớp (giả)" } })) ?? await mkUser({ name: "Em Thử Hai Lớp (giả)" });
  for (const c of [toan, ly]) {
    if (!(await prisma.enrollment.findFirst({ where: { userId: em.id, courseId: c.id } }))) await prisma.enrollment.create({ data: { userId: em.id, courseId: c.id, status: "active" } });
  }
  return [
    `Lưới kéo-thả — đăng nhập giasu@kin.local → /lop-cua-toi/quan-lop/${toan.id}/lich-hoc (hoặc Lịch → "Sửa khung giờ" → chọn lớp): kéo trên ô trống để thêm khung, kéo khối để dời, kéo mép để đổi độ dài; Delete tắt khung (có Hoàn tác).`,
    `Trùng giờ — kéo khối Toán 9 sang Thứ Tư 19:00: khối có viền nét đứt + chữ "Trùng giờ"; thả → hộp "Khung giờ này trùng lịch … có 1 học sinh học cả hai lớp" → Vẫn lưu / Hoàn lại. Thứ Sáu 19:00–20:00 chạm đầu Lý 8 20:00 thì không trùng.`,
    `Điện thoại (390px) — cùng trang: chế độ Ngày/Tuần; bấm ô trống hoặc bấm khối mở panel chọn giờ; chạm giữ ~0,35 giây rồi kéo để dời.`,
    `Lớp chưa lịch — "${N_VAN}": Lớp (/lop-cua-toi/lop) có liên kết "Đặt lịch"; mở lớp thấy khung "Lớp chưa có lịch học"; Hộp việc có hàng "chưa có lịch học". Tạo lớp mới (/lop-cua-toi/lop/tao) bước 2 phải có ≥ 1 khung hoặc chọn "Lớp này học buổi lẻ".`,
  ];
}
